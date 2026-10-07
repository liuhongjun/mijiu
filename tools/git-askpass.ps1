# tools/git-askpass.ps1 —— 供 GIT_ASKPASS 使用：从 Windows 凭据管理器取 GitHub token
# 安全提示：本文件只读取凭据，不含任何明文密钥；请勿把 token 写入仓库。
param([string]$Prompt = "")
Add-Type -Namespace DSH -Name CredApi -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL {
  public uint Flags; public uint Type; public string TargetName; public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
  public uint CredentialBlobSize; public System.IntPtr CredentialBlob;
  public uint Persist; public uint AttributeCount; public System.IntPtr Attributes;
  public string TargetAlias; public string UserName;
}
[DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, uint type, uint flags, out System.IntPtr credential);
[DllImport("advapi32.dll", SetLastError = true)]
public static extern void CredFree(System.IntPtr cred);
'@
function Get-Secret([string]$target) {
  $ptr = [IntPtr]::Zero
  if (-not [DSH.CredApi]::CredRead($target, 1, 0, [ref]$ptr)) { return $null }
  try {
    $c = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][DSH.CredApi+CREDENTIAL])
    return [System.Runtime.InteropServices.Marshal]::PtrToStringUni($c.CredentialBlob, [int]($c.CredentialBlobSize / 2))
  } finally { [DSH.CredApi]::CredFree($ptr) | Out-Null }
}
$targets = @('git:https://github.com', 'git:https://github.com/liuhongjun/mijiu.git', 'legacy:generic:git:https://github.com')
$secret = $null
foreach ($t in $targets) { $s = Get-Secret $t; if ($s) { $secret = $s; break } }
if (-not $secret) {
  # 兜底：扫描 Windows 凭据目录，找含 github 的目标
  $dir = Join-Path $env:APPDATA 'Microsoft\Credentials'
  $found = $null
  if (Test-Path $dir) {
    Get-ChildItem $dir -File | ForEach-Object {
      $b = [System.IO.File]::ReadAllBytes($_.FullName)
      $u = [System.Text.Encoding]::Unicode.GetString($b)
      if ($u -match 'github') { $found = $_.Name }
    }
  }
  [Console]::Out.Write("")
  exit 1
}
if ($Prompt -match 'Username') { [Console]::Out.Write('x-access-token') } else { [Console]::Out.Write($secret) }
exit 0
