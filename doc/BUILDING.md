# Building the application

Should you wish to build this, it is necessary to have nodejs installed (currently version v14.0.9)
as well as npm (currently version 6.14.8).

As javascript is an evolving language, the source code is transpiled to an older (simpler/uglier) format,
which is then executed. This is to be compatible with some of the used modules.
This means that the source code that is visible in the chrome debugging tool is close, but not exactly what is
found in the scripts folder.

```bash
npm install
npm run-script build
npm start

```

## Building binaries for Windows
To build a Windows executable to the following step (on a Windows machine)

```bash
npm run-script win
# this will create an electron applications for Windows (installable and stand-alone)
# './dist/visualreqm2-2.4.1-setup.exe'
# './dist/visualreqm2-2.4.1.exe'
```

### Windows signing

For Windows there are some optional signing configuration.

You will need to provide your own certificate and associated password
The signing is necessary for the auto-update feature to work, but this feature is default off.
The signing for Windows is configured with two environment variables. See https://www.electron.build/code-signing for details.
```bash
CSC_KEY_PASSWORD=somesecretpasswordwhichisnotthisone
# Define path to certificate - your path may vary
CSC_LINK=~/certs/app_cert.pfx
```

## Building binaries for Linux

To build a Linux executable to the following step (on a Linux machine)

```bash
npm run-script linux
# this will create .rpm , .dep and .AppImage binaries
# './dist/Visual ReqM2 Setup 0.98.2.AppImage'
```

Read about testing and requirements tracing in [TEST_AND_TRACE.md](TEST_AND_TRACE.md).
