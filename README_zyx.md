# intro


## Build CLI

cargo build -p openfang-cli

## Start daemon/API + dashboard

```
.\target\debug\openfang.exe start
```

Then open: http://127.0.0.1:4200

Optional first-time setup:

```
.\target\debug\openfang.exe init
```

If you prefer release build:

```
cargo build --release -p openfang-cli
```

.\target\release\openfang.exe start