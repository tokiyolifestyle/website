$csharpSource = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredMan {
    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetPassword(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] blob = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, blob, 0, cred.CredentialBlobSize);
            CredFree(credPtr);
            if (cred.CredentialBlobSize >= 2 && blob[1] == 0) {
                return Encoding.Unicode.GetString(blob).Trim('\0', ' ', '\r', '\n');
            } else {
                return Encoding.UTF8.GetString(blob).Trim('\0', ' ', '\r', '\n');
            }
        }
        return null;
    }
}
"@

Add-Type -TypeDefinition $csharpSource

$targets = @(
    "LegacyGeneric:target=git:https://tokiyolifestyle@github.com",
    "git:https://tokiyolifestyle@github.com",
    "LegacyGeneric:target=GitHub - https://api.github.com/tokiyolifestyle",
    "git:https://github.com"
)

$token = $null
foreach ($t in $targets) {
    $token = [CredMan]::GetPassword($t)
    if ($token) {
        break
    }
}

if ($token) {
    Write-Host "Token retrieved successfully!"
    $remoteUrl = "https://${token}@github.com/tokiyolifestyle/website.git"
    git -c credential.helper= pull --rebase $remoteUrl main
    git -c credential.helper= push $remoteUrl main
} else {
    Write-Error "Could not retrieve token from Windows Credential Manager"
}
