# 一键发布到 GitHub Pages（gh-pages 分支）
# 用法：pwsh -File scripts/deploy-pages.ps1
# 仓库地址：https://github.com/limingfeng2026/threejs-web-vue
# 站点：https://limingfeng2026.github.io/threejs-web-vue/
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$wt = Join-Path (Split-Path $root -Parent) '_ghpages'
$base = '/threejs-web-vue/'

Set-Location $root
Write-Host '1/4 构建（base = ' $base '）...'
npm run build:pages
if ($LASTEXITCODE -ne 0) { throw '构建失败，已中止' }

Write-Host '2/4 准备发布工作树...'
if (-not (Test-Path $wt)) { git worktree add -B gh-pages $wt | Out-Null }
Set-Location $wt
git rm -rf . --quiet 2>$null
Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force

Write-Host '3/4 拷贝构建产物...'
Copy-Item (Join-Path $root 'dist\*') $wt -Recurse -Force
New-Item (Join-Path $wt '.nojekyll') -ItemType File -Force | Out-Null
git add -A
git commit -q -m ("deploy: " + (Get-Date -Format 'yyyy-MM-dd HH:mm'))
if ($LASTEXITCODE -ne 0) { Write-Host '无变化，跳过提交' }

Write-Host '4/4 推送 gh-pages...'
$env:GIT_TERMINAL_PROMPT = '0'
git push -u origin gh-pages
Set-Location $root
Write-Host '完成：https://limingfeng2026.github.io/threejs-web-vue/'
