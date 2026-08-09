/**
 * Copyright 2026 The PSU-EXT Authors
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageConfigProxy } from "../PageConfigProxy.jsx";

const mockConnection = vi.hoisted(() => ({
  config: {
    autoConnect: false,
    deviceAutoConnectIds: [],
    wsScheme: "ws",
    wsHost: "localhost",
    wsPort: "8080",
    wsPath: "/ws/scpi",
    deviceMode: "tcp",
    tcpHost: "192.168.4.1",
    tcpPort: "5025",
    usbComPort: "",
  },
  wsConnected: false,
  wsConnecting: false,
  devices: [
    { id: "0", name: "PSU1", type: "TCP", ip: "192.168.4.1", port: "5025", baudrate: "" },
    { id: "1", name: "USB1", type: "USB", ip: "", port: "COM3", baudrate: "115200" },
  ],
  deviceStatuses: {
    0: { state: "DISCONNECTED" },
    1: { state: "DISCONNECTED" },
  },
  deviceConnected: false,
  deviceConnecting: false,
  deviceConnectingIds: [],
  deviceIdentity: {
    name: "",
    raw: "",
    valid: false,
    error: null,
    serialNumber: "",
    firmwareLevel: "",
  },
  wsMessages: "",
  getWsMessages: vi.fn(() => ""),
  subscribeWsMessages: vi.fn(() => vi.fn()),
  updateConfig: vi.fn(),
  saveConfig: vi.fn(),
  clearConnectionConfig: vi.fn(),
  connectWs: vi.fn(),
  disconnectWs: vi.fn(),
  connectDevice: vi.fn(),
  connectAllTcpDevices: vi.fn(),
  setDeviceAutoConnect: vi.fn(),
  disconnectDevice: vi.fn(),
  addDevice: vi.fn(),
  modifyDevice: vi.fn(),
  deleteDevice: vi.fn(),
  sendScpiCommand: vi.fn(),
  clearWsMessages: vi.fn(),
}));

vi.mock("../../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("PageConfigProxy", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    mockConnection.config = {
      autoConnect: false,
      deviceAutoConnectIds: [],
      wsScheme: "ws",
      wsHost: "localhost",
      wsPort: "8080",
      wsPath: "/ws/scpi",
      deviceMode: "tcp",
      tcpHost: "192.168.4.1",
      tcpPort: "5025",
      usbComPort: "",
    };
    mockConnection.wsConnected = false;
    mockConnection.wsConnecting = false;
    mockConnection.devices = [
      { id: "0", name: "PSU1", type: "TCP", ip: "192.168.4.1", port: "5025", baudrate: "" },
      { id: "1", name: "USB1", type: "USB", ip: "", port: "COM3", baudrate: "115200" },
    ];
    mockConnection.deviceStatuses = {
      0: { state: "DISCONNECTED" },
      1: { state: "DISCONNECTED" },
    };
    mockConnection.deviceConnected = false;
    mockConnection.deviceConnecting = false;
    mockConnection.deviceConnectingIds = [];
    mockConnection.deviceIdentity = {
      name: "",
      raw: "",
      valid: false,
      error: null,
      serialNumber: "",
      firmwareLevel: "",
    };
    mockConnection.wsMessages = "";
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);
    mockConnection.subscribeWsMessages.mockImplementation(() => vi.fn());
    mockConnection.updateConfig.mockReset();
    mockConnection.saveConfig.mockReset();
    mockConnection.clearConnectionConfig.mockReset();
    mockConnection.connectWs.mockReset();
    mockConnection.disconnectWs.mockReset();
    mockConnection.connectDevice.mockReset();
    mockConnection.connectAllTcpDevices.mockReset();
    mockConnection.setDeviceAutoConnect.mockReset();
    mockConnection.disconnectDevice.mockReset();
    mockConnection.addDevice.mockReset();
    mockConnection.modifyDevice.mockReset();
    mockConnection.deleteDevice.mockReset();
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.clearWsMessages.mockReset();
  });

  it("renders config as standard dashboard widgets", () => {
    render(<PageConfigProxy />);

    expect(screen.getByLabelText("Dashboard widget grid")).toBeInTheDocument();
    expect(screen.getByLabelText("WebSocket")).toBeInTheDocument();
    expect(screen.getByLabelText("Device List")).toBeInTheDocument();
    expect(screen.getByLabelText("WebSocket Monitor")).toBeInTheDocument();
    expect(screen.getByLabelText("WebSocket")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "1 / span 2",
    });
    expect(screen.getByLabelText("Device List")).toHaveStyle({
      gridColumn: "1 / span 3",
      gridRow: "3 / span 1",
    });
    expect(screen.getByLabelText("WebSocket Monitor")).toHaveStyle({
      gridColumn: "2 / span 2",
      gridRow: "1 / span 2",
    });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Widget" })).not.toBeInTheDocument();
  });

  it("places auto-connect and clear in the WebSocket widget", () => {
    render(<PageConfigProxy />);

    const webSocketWidget = screen.getByLabelText("WebSocket");
    const clearButton = within(webSocketWidget).getByRole("button", { name: "Clear connection config" });
    const connectButton = within(webSocketWidget).getByRole("button", { name: "Connect" });

    expect(within(webSocketWidget).getByText("Proxy auto-connect")).toBeInTheDocument();
    expect(clearButton).toBeInTheDocument();
    expect(webSocketWidget).toHaveTextContent("Disconnected");
    expect(within(webSocketWidget).getAllByText("Status")).toHaveLength(1);
    expect(clearButton.parentElement).not.toHaveClass("mt-auto");
    expect(connectButton.parentElement).toHaveClass("mt-auto");
  });

  it("reflects WebSocket and Device status from connection state", () => {
    mockConnection.wsConnected = true;
    mockConnection.deviceStatuses = {
      0: {
        state: "CONNECTED",
        identity: {
          name: "Acme Instruments PSU-EXT",
          serialNumber: "SN01",
          firmwareLevel: "1.0",
          valid: true,
        },
      },
      1: { state: "DISCONNECTED" },
    };

    render(<PageConfigProxy />);

    expect(screen.getByLabelText("WebSocket")).toHaveTextContent("Connected");
    expect(screen.getByLabelText("Device List")).toHaveTextContent("PSU1");
    expect(screen.getByLabelText("Device List")).toHaveTextContent("CONNECTED");
    expect(within(screen.getByLabelText("Device List")).getByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Device List")).toHaveTextContent(
      "Acme Instruments PSU-EXT | SN SN01 | FW 1.0",
    );
  });

  it("keeps the WebSocket widget actions grouped above the bottom primary action", () => {
    render(<PageConfigProxy />);

    const webSocketWidget = screen.getByLabelText("WebSocket");
    const connectButton = within(webSocketWidget).getByRole("button", { name: "Connect" });
    const statusText = within(webSocketWidget).getByText("Disconnected");
    const autoConnectText = within(webSocketWidget).getByText("Proxy auto-connect");
    const clearButton = within(webSocketWidget).getByRole("button", { name: "Clear connection config" });

    expect(autoConnectText.closest(".grid")).toContainElement(statusText.parentElement);
    expect(clearButton.parentElement).toContainElement(autoConnectText.closest("label"));
    expect(connectButton.parentElement).toHaveClass("mt-auto");
    expect(connectButton).toHaveClass("w-full");
    expect(within(webSocketWidget).getByText("Status")).toBeInTheDocument();
  });

  it("renders per-device auto-connect toggles and updates them by device id", () => {
    mockConnection.wsConnected = true;
    mockConnection.config.deviceAutoConnectIds = ["1"];

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    const psuToggle = within(deviceListWidget).getByRole("checkbox", { name: "Auto-connect device PSU1" });
    const usbToggle = within(deviceListWidget).getByRole("checkbox", { name: "Auto-connect device USB1" });

    expect(within(deviceListWidget).getByText("AUTO")).toHaveAttribute("title", "Auto-connect");
    expect(psuToggle).not.toBeChecked();
    expect(usbToggle).toBeChecked();

    psuToggle.click();

    expect(mockConnection.setDeviceAutoConnect).toHaveBeenCalledWith("0", true);
  });

  it("adds per-device connect actions to the device list", () => {
    mockConnection.wsConnected = true;

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    const connectButtons = within(deviceListWidget).getAllByRole("button", { name: "Connect" });

    connectButtons[0].click();

    expect(mockConnection.connectDevice).toHaveBeenCalledWith("0");
  });

  it("shows per-device disconnect action for connected rows", () => {
    mockConnection.wsConnected = true;
    mockConnection.deviceStatuses = {
      0: { state: "CONNECTED" },
      1: { state: "DISCONNECTED" },
    };

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");

    within(deviceListWidget).getByRole("button", { name: "Disconnect" }).click();

    expect(mockConnection.disconnectDevice).toHaveBeenCalledWith("0");
  });

  it("shows fixed-width identity text with a full-value tooltip", () => {
    mockConnection.wsConnected = true;
    mockConnection.deviceStatuses = {
      0: {
        state: "CONNECTED",
        identity: {
          name: "Acme Instruments PSU-EXT",
          serialNumber: "SN01",
          firmwareLevel: "1.0",
          valid: true,
        },
      },
      1: { state: "DISCONNECTED" },
    };

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    const identityCellText = within(deviceListWidget).getByText("Acme Instruments PSU-EXT | SN SN01 | FW 1.0");

    expect(identityCellText).toHaveClass("inline-block", "whitespace-nowrap");
    expect(identityCellText.parentElement).toHaveClass("overflow-hidden");
    expect(identityCellText.parentElement).toHaveAttribute(
      "title",
      "Acme Instruments PSU-EXT | SN SN01 | FW 1.0",
    );
  });

  it("uses the shared cardless monitor body in the monitor widget", () => {
    render(<PageConfigProxy />);

    const monitorWidget = screen.getByLabelText("WebSocket Monitor");

    expect(within(monitorWidget).getByText("No websocket messages yet.")).toBeInTheDocument();
    expect(within(monitorWidget).getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(within(monitorWidget).getAllByText("WebSocket Monitor")).toHaveLength(1);
    expect(within(monitorWidget).getByText("No websocket messages yet.")).toHaveClass(
      "h-[18.7rem]",
      "overflow-x-hidden",
      "whitespace-pre-wrap",
    );
    expect(within(monitorWidget).getByRole("textbox").parentElement).toHaveClass("mt-auto");
  });

  it("shows offline message in device list when WebSocket is disconnected", () => {
    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");

    expect(within(deviceListWidget).getByText(/WebSocket offline/)).toBeInTheDocument();
    expect(within(deviceListWidget).queryByRole("table")).not.toBeInTheDocument();
    expect(within(deviceListWidget).queryByRole("button", { name: "Add Device" })).not.toBeInTheDocument();
  });

  it("shows empty-state row when WebSocket is connected but no devices exist", () => {
    mockConnection.wsConnected = true;
    mockConnection.devices = [];

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");

    expect(within(deviceListWidget).getByRole("table")).toBeInTheDocument();
    expect(within(deviceListWidget).getByText(/No devices configured/)).toBeInTheDocument();
  });

  it("opens add-device modal on Add Device click and calls addDevice on submit", async () => {
    mockConnection.wsConnected = true;
    mockConnection.addDevice.mockResolvedValue();

    render(<PageConfigProxy />);

    fireEvent.click(screen.getByRole("button", { name: "Add Device" }));

    const dialog = screen.getByRole("heading", { name: "Add Device" }).closest(".fixed");
    expect(dialog).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "PSU2" } });
    fireEvent.change(within(dialog).getByLabelText("IP"), { target: { value: "192.168.1.2" } });
    fireEvent.change(within(dialog).getByLabelText("Port"), { target: { value: "5025" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Device" }));

    expect(mockConnection.addDevice).toHaveBeenCalledWith({
      name: "PSU2",
      type: "TCP",
      ip: "192.168.1.2",
      port: "5025",
      baudrate: "",
    });
  });

  it("opens edit-device modal pre-populated with current values and calls modifyDevice on submit", async () => {
    mockConnection.wsConnected = true;
    mockConnection.modifyDevice.mockResolvedValue();

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    fireEvent.click(within(deviceListWidget).getAllByRole("button", { name: /Edit device/ })[0]);

    const dialog = screen.getByRole("heading", { name: /Edit Device/ }).closest(".fixed");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("PSU1");
    expect(within(dialog).getByLabelText("IP")).toHaveValue("192.168.4.1");
    expect(within(dialog).getByLabelText("Port")).toHaveValue("5025");

    fireEvent.change(within(dialog).getByLabelText("IP"), { target: { value: "10.0.0.1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(mockConnection.modifyDevice).toHaveBeenCalledWith("0", {
      name: "PSU1",
      type: "TCP",
      ip: "10.0.0.1",
      port: "5025",
      baudrate: "",
    });
  });

  it("shows inline error in device form when addDevice rejects", async () => {
    mockConnection.wsConnected = true;
    mockConnection.addDevice.mockRejectedValue("ERR DUPLICATE_NAME");

    render(<PageConfigProxy />);

    fireEvent.click(screen.getByRole("button", { name: "Add Device" }));

    const dialog = screen.getByRole("heading", { name: "Add Device" }).closest(".fixed");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "PSU1" } });
    fireEvent.change(within(dialog).getByLabelText("IP"), { target: { value: "192.168.1.1" } });
    fireEvent.change(within(dialog).getByLabelText("Port"), { target: { value: "5025" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Device" }));

    expect(await within(dialog).findByText("ERR DUPLICATE_NAME")).toBeInTheDocument();
  });

  it("opens delete dialog and calls deleteDevice on confirm", async () => {
    mockConnection.wsConnected = true;
    mockConnection.deleteDevice.mockResolvedValue();

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    fireEvent.click(within(deviceListWidget).getAllByRole("button", { name: /Delete device/ })[0]);

    const dialog = screen.getByRole("heading", { name: "Delete Device" }).closest(".fixed");
    expect(within(dialog).getByText(/PSU1/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(mockConnection.deleteDevice).toHaveBeenCalledWith("0");
  });

  it("shows inline error in delete dialog when deleteDevice rejects", async () => {
    mockConnection.wsConnected = true;
    mockConnection.deleteDevice.mockRejectedValue("ERR DEVICE_BUSY");

    render(<PageConfigProxy />);

    const deviceListWidget = screen.getByLabelText("Device List");
    fireEvent.click(within(deviceListWidget).getAllByRole("button", { name: /Delete device/ })[0]);

    const dialog = screen.getByRole("heading", { name: "Delete Device" }).closest(".fixed");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByText("ERR DEVICE_BUSY")).toBeInTheDocument();
  });
});
