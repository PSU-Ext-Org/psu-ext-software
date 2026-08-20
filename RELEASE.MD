# PSU-EXT Release Guide

## Release steps

Choose the release version without a leading `v`:

```sh
git switch main
git pull --ff-only
export VERSION=0.1.0
```

### 1. Update Java versions

From the repository root:

```sh
cd psu-be
./mvnw -q versions:set \
  -DnewVersion="$VERSION" \
  -DprocessAllModules=true \
  -DgenerateBackupPoms=false
cd ..
```

This updates all PSU-BE Maven projects. Release versions must not end in
`-SNAPSHOT`.

### 2. Update the JavaScript version

```sh
cd psu-fe
npm version "$VERSION" --no-git-tag-version --allow-same-version
cd ..
```

This updates both `psu-fe/package.json` and `psu-fe/package-lock.json`.

### 3. Commit and push

Review the version changes, then create the release-preparation commit:

```sh
git diff
git add psu-be psu-fe/package.json psu-fe/package-lock.json
git commit -s -S -m "Software/PSU-REL: Prepare $VERSION release"
git push origin main
```

### 4. Wait for CI

Open GitHub Actions and wait for the `CI` workflow on `main` to succeed. Do not
create the release tag if CI fails.

### 5. Create the release tag

The tag must be the same version with a leading `v`:

```sh
git tag -a "v$VERSION" -m "PSU-EXT $VERSION"
git push origin "v$VERSION"
```

For example, Java and JavaScript version `0.1.0` must use Git tag `v0.1.0`.

Pushing the tag starts `.github/workflows/release.yml`. Wait for the
`Release installer` workflow to succeed, then confirm that the GitHub Release
contains:

```text
psu-ext-linux-amd64
psu-ext-bundle-linux-amd64.tar.gz
psu-ext-darwin-arm64
psu-ext-bundle-darwin-arm64.tar.gz
psu-ext-windows-amd64.exe
psu-ext-bundle-windows-amd64.zip
release-manifest.json
checksums.txt
```

Confirm that `release-manifest.json` contains `linux-amd64`, `darwin-arm64`,
and `windows-amd64`. Initial macOS and Windows artifacts are unsigned.

### 6. Prepare the next development iteration

After the release workflow succeeds, choose the next version with a
`-SNAPSHOT` suffix:

```sh
export NEXT_VERSION=0.1.1-SNAPSHOT
```

Update the Java and JavaScript versions from the repository root:

```sh
cd psu-be
./mvnw -q versions:set \
  -DnewVersion="$NEXT_VERSION" \
  -DprocessAllModules=true \
  -DgenerateBackupPoms=false
cd ../psu-fe
npm version "$NEXT_VERSION" --no-git-tag-version --allow-same-version
cd ..
```

Review, commit, and push the next-iteration versions:

```sh
git diff
git add psu-be psu-fe/package.json psu-fe/package-lock.json
git commit -s -S -m "Software/PSU-REL: Start $NEXT_VERSION development iteration"
git push origin main
```

Published tags are immutable. Fix a published release by preparing and tagging
a new patch version.
