package com.psuext.script.execution.scpi;

/*-
 * #%L
 * PSU-BE Script Runner
 * %%
 * Copyright (C) 2026 The PSU-EXT Authors
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.transport.core.model.ScpiTransportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The script-runner-owned SCPI session for one connected device.
 *
 * <p>SCPI response frames contain no request identifier. This class therefore
 * owns a single FIFO worker for one persisted device ID. A worker executes the
 * complete request/reply exchange before starting the next operation, so a
 * response cannot be consumed by a different script request.
 *
 * <p>The session is intentionally package-private. {@link ScriptDeviceSessionCoordinator}
 * is the only lifecycle owner: it creates a session after connect, removes it
 * before disconnect, and is notified when this session becomes unusable.
 */
final class DeviceSession {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceSession.class);
    private static final Pattern QUERY_HEADER_PATTERN = Pattern.compile("^\\s*\\S*\\?.*");

    private final DeviceConnection device;
    private final ConnectionManagementService connectionService;
    private final BiConsumer<DeviceSession, String> invalidationCallback;
    private final ThreadPoolExecutor executor;
    private final AtomicBoolean accepting = new AtomicBoolean(true);

    /**
     * Creates the FIFO worker for an already connected device.
     *
     * @param device stable persisted device profile
     * @param connectionService shared transport facade
     * @param invalidationCallback invoked when connection loss or failed recovery ends this session
     */
    DeviceSession(
            DeviceConnection device,
            ConnectionManagementService connectionService,
            BiConsumer<DeviceSession, String> invalidationCallback) {
        this.device = Objects.requireNonNull(device, "device must not be null");
        this.connectionService = Objects.requireNonNull(connectionService, "connectionService must not be null");
        this.invalidationCallback = Objects.requireNonNull(invalidationCallback, "invalidationCallback must not be null");
        this.executor = new ThreadPoolExecutor(
                1,
                1,
                0,
                TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(),
                runnable -> new Thread(runnable, "script-scpi-device-" + device.id()));
    }

    /** @return the persisted device identity used as this session's queue key */
    DeviceConnection device() {
        return device;
    }

    /** @return whether new script requests may enter this session's FIFO queue */
    boolean accepting() {
        return accepting.get();
    }

    /** Stops new work without interrupting the operation currently using the transport. */
    void stopAccepting() {
        accepting.set(false);
    }

    /**
     * Enqueues one complete SCPI operation and waits for its result.
     *
     * <p>The caller blocks, but the operation itself runs on the device worker.
     * Calls for other devices use different workers and may proceed in parallel.
     *
     * @param command SCPI command without its transport line ending
     * @return the transport response produced exclusively by this request
     * @throws ScriptScpiException when the session is closed, the wait is interrupted, or execution fails
     */
    ScpiTransportResponse submit(String command) {
        String requestId = UUID.randomUUID().toString();
        CompletableFuture<ScpiTransportResponse> result = new CompletableFuture<>();
        if (!accepting.get()) {
            throw disconnected();
        }
        try {
            executor.execute(() -> execute(requestId, command, result));
        } catch (RuntimeException exception) {
            throw disconnected();
        }
        try {
            return result.get();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ScriptScpiException("INTERRUPTED", "Interrupted while waiting for a SCPI request");
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();
            if (cause instanceof ScriptScpiException scriptException) {
                throw scriptException;
            }
            throw new ScriptScpiException("CONNECTION_ERROR", safeMessage(cause));
        }
    }

    /**
     * Closes this session in queue order. Queued operations observe the closed
     * state and fail without reaching the transport; an active operation is
     * allowed to finish before the transport disconnect runs.
     *
     * @return transport disconnect response
     */
    ScpiTransportResponse closeAndDisconnect() {
        accepting.set(false);
        CompletableFuture<ScpiTransportResponse> result = new CompletableFuture<>();
        executor.execute(() -> {
            try {
                result.complete(connectionService.disconnect(String.valueOf(device.id())));
            } catch (RuntimeException exception) {
                result.completeExceptionally(exception);
            } finally {
                executor.shutdown();
            }
        });
        try {
            return result.get();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ScriptScpiException("INTERRUPTED", "Interrupted while disconnecting device " + device.name());
        } catch (ExecutionException exception) {
            throw new ScriptScpiException("CONNECTION_ERROR", safeMessage(exception.getCause()));
        }
    }

    private void execute(String requestId, String command, CompletableFuture<ScpiTransportResponse> result) {
        if (!accepting.get()) {
            result.completeExceptionally(disconnected());
            return;
        }
        LOGGER.debug("Script SCPI request started: requestId={} device={} command={}", requestId, device.id(), command);
        try {
            ScpiTransportResponse response = normalizeDeviceError(
                    connectionService.send(String.valueOf(device.id()), command));
            recoverIfRequired(response, requestId, isQuery(command));
            LOGGER.debug("Script SCPI request completed: requestId={} device={} code={}",
                    requestId, device.id(), response.code());
            result.complete(response);
        } catch (RuntimeException exception) {
            LOGGER.warn("Script SCPI request failed: requestId={} device={} error={}",
                    requestId, device.id(), safeMessage(exception));
            result.completeExceptionally(exception);
        }
    }

    /**
     * Converts a device-level SCPI error line into a transport error.
     *
     * <p>A command without a query marker normally produces no reply. When a
     * device rejects one, however, it can emit an {@code ERR,...} line that
     * remains in the serial receive buffer. The next query would otherwise
     * consume that line as its own result. Treating it as an error here lets
     * {@link #recoverIfRequired(ScpiTransportResponse, String, boolean)} reset the
     * session before another queued request starts.
     */
    private ScpiTransportResponse normalizeDeviceError(ScpiTransportResponse response) {
        if (response instanceof ScpiTransportResponse.Text text
                && text.rawResponse().trim().startsWith("ERR,")) {
            return ScpiTransportResponse.error("SCPI_ERROR", text.rawResponse());
        }
        return response;
    }

    private static boolean isQuery(String command) {
        return QUERY_HEADER_PATTERN.matcher(command).matches();
    }

    private void recoverIfRequired(ScpiTransportResponse response, String requestId, boolean query) {
        if (!(response instanceof ScpiTransportResponse.Error error)) {
            return;
        }
        if ("TIMEOUT".equals(error.code())) {
            LOGGER.warn("Script SCPI timeout; resetting transport: requestId={} device={}", requestId, device.id());
            resetTransport();
            return;
        }
        if ("SCPI_ERROR".equals(error.code())) {
            if (!query) {
                return;
            }
            LOGGER.warn("Script SCPI device error; resetting transport: requestId={} device={}", requestId, device.id());
            resetTransport();
            return;
        }
        if ("CONNECTION_LOST".equals(error.code()) || "DISCONNECTED".equals(error.code())) {
            invalidate(error.code());
        }
    }

    private void resetTransport() {
        connectionService.disconnect(String.valueOf(device.id()));
        ScpiTransportResponse reconnect = connectionService.connect(String.valueOf(device.id()));
        if (!reconnect.ok()) {
            invalidate("reconnect failed after error recovery");
        }
    }

    private void invalidate(String reason) {
        accepting.set(false);
        invalidationCallback.accept(this, reason);
        executor.shutdown();
    }

    private ScriptScpiException disconnected() {
        return new ScriptScpiException("DISCONNECTED", "Device is not connected for script execution: " + device.name());
    }

    private static String safeMessage(Throwable throwable) {
        if (throwable == null || throwable.getMessage() == null || throwable.getMessage().isBlank()) {
            return throwable == null ? "Unknown error" : throwable.getClass().getSimpleName();
        }
        return throwable.getMessage();
    }
}
