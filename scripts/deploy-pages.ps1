# 一键发布到 GitHub Pages（gh-pages 分支）
# 用法：pwsh -File scripts/deploy-pages.ps1
# 站点：https://limingfeng2026.github.io/threejs-web-vue/
#
# 每次发布都把 gh-pages 重建为「孤儿分支 + 单提交」：构建产物不进历史，
# 否则每发一次版本，仓库里就多囤一份几百 MB 的 dist。
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$wt = Join-Path (Split-Path $root -Parent) '_ghpages'
$base = '/threejs-web-vue/'

Set-Location $root
Write-Host '1/4 构建（base =' $base '）...'
npm run build:pages
if ($LASTEXITCODE -ne 0) { throw '构建失败，已中止' }

Write-Host '2/4 重建发布工作树...'
if (Test-Path $wt) {
  git worktree remove $wt -f 2>$null
  if (Test-Path $wt) { Remove-Item $wt -Recurse -Force }
}
git branch -D gh-pages 2>$null | Out-Null
git worktree add --detach $wt | Out-Null

Set-Location $wt
git switch --orphan gh-pages | Out-Null

Write-Host '3/4 拷贝构建产物...'
Copy-Item (Join-Path $root 'dist\*') $wt -Recurse -Force
New-Item (Join-Path $wt '.nojekyll') -ItemType File -Force | Out-Null
git add -A
git commit -q -m ("deploy: " + (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($LASTEXITCODE -ne 0) { throw '提交失败，已中止' }

Write-Host '4/4 强推 gh-pages（单提交）...'
$env:GIT_TERMINAL_PROMPT = '0'
git push -f origin gh-pages
if ($LASTEXITCODE -ne 0) { throw '推送失败，检查网络后重跑本脚本' }

Set-Location $root
$size = (Get-ChildItem (Join-Path $wt 'assets'), (Join-Path $wt '3d'), (Join-Path $wt 'tiles-ofm'), (Join-Path $wt 'tiles-sat') -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ('完成，站点约 {0:N1} MB：https://limingfeng2026.github.io/threejs-web-vue/' -f ($size / 1MB))
