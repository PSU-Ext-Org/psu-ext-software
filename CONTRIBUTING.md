# Contributing

Thanks for your interest in contributing.

## License

This project is licensed under the [Apache License, Version 2.0](LICENSE).
By submitting a contribution (a pull request, patch, or any other form of
proposed change), you agree that your contribution is licensed under the
same terms, and that you have the right to submit it under those terms.

## Developer Certificate of Origin (DCO)

Instead of a separate Contributor License Agreement, this project uses the
[Developer Certificate of Origin](https://developercertificate.org/) (DCO).
Every commit in a pull request must include a `Signed-off-by` trailer
certifying that you wrote the change, or otherwise have the right to submit
it under the project's license.

Add the trailer automatically with `git commit -s`:

```
git commit -s -m "Your commit message"
```

This appends a line to your commit message like:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name and a reachable email address — anonymous or pseudonymous
sign-offs are not accepted. If you forgot to sign off a commit, amend it
with `git commit --amend -s` (or use `git rebase --exec 'git commit --amend --no-edit -s'`
for multiple commits) before opening or updating the pull request.

## Third-party dependencies

Each subproject maintains its own third-party notices, scoped to its own
dependency ecosystem (e.g. Maven for `psu-be`, npm for any future frontend).

If your change adds, removes, or upgrades a dependency in `psu-be-bom`,
regenerate and update `psu-be/THIRD-PARTY-NOTICES.md` in the same pull
request, from the `psu-be` directory:

```
./mvnw org.codehaus.mojo:license-maven-plugin:2.5.0:aggregate-add-third-party
```

Review the output and update `psu-be/THIRD-PARTY-NOTICES.md` accordingly,
especially if the new dependency's license differs from
Apache-2.0/MIT/BSD/EPL.

## Getting started

See `psu-be/AGENTS.md` and `psu-be/README.md` for the backend workspace's
build setup, coding conventions, and verification commands.
