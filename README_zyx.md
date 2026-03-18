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


## 安装技能

手动安装这个 skill，最稳的做法是把整个仓库按“一个技能一个子目录”放到 OpenFang 的全局技能目录里。

这个仓库我已经核过了，里面本身就有 SKILL.md，所以不需要你自己拆文件或写 skill.json。仓库地址是: https://github.com/Xiangyu-CAS/xiaohongshu-ops-skill

直接这样装就行，Windows PowerShell:

$skillRoot = "$HOME\.openfang\skills"
$skillDir = Join-Path $skillRoot "xiaohongshu-ops-skill"

New-Item -ItemType Directory -Force -Path $skillRoot | Out-Null

git clone https://github.com/Xiangyu-CAS/xiaohongshu-ops-skill.git $skillDir
如果你已经 clone 过了，就更新:

git -C "$HOME\.openfang\skills\xiaohongshu-ops-skill" pull
安装后的正确目录应该是这样:

C:\Users\pc\.openfang\skills\xiaohongshu-ops-skill\SKILL.md
C:\Users\pc\.openfang\skills\xiaohongshu-ops-skill\persona.md
C:\Users\pc\.openfang\skills\xiaohongshu-ops-skill\references\...
C:\Users\pc\.openfang\skills\xiaohongshu-ops-skill\examples\...
注意两点:

不能把这些文件平铺到 skills\ 根目录，必须放在 skills\xiaohongshu-ops-skill\ 这个子目录里。
不要自己写 xiaohongshu-ops-skill.json，OpenFang 会从 SKILL.md 自动转换加载。
装完后重启 OpenFang 后端进程，再去 Skills 页刷新；如果系统启动时加载成功，它会被识别。这个行为对应的加载逻辑在 registry.rs 和 kernel.rs。

如果你想，我也可以下一步直接帮你把这个仓库复制到你机器上的正确目录，并检查重启后是否被识别。