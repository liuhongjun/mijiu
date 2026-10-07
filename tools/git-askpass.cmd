@echo off
rem Git askpass 包装器：把参数透传给 PowerShell 脚本
rem 需要环境变量 GIT_ASKPASS_SCRIPT 指向 git-askpass.ps1 的绝对路径
powershell -NoProfile -ExecutionPolicy Bypass -File "%GIT_ASKPASS_SCRIPT%" -Prompt "%~1"
