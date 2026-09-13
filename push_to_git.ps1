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
            return Encoding.Unicode.GetString(blob);
        }
        return null;
    }
}
"@

Add-Type -TypeDefinition $csharpSource

$token = [CredMan]::GetPassword("LegacyGeneric:target=GitHub - https://api.github.com/tokiyolifestyle")
if (-not $token) {
    # try other targets if needed
    $token = [CredMan]::GetPassword("git:https://github.com")
}

if ($token) {
    Write-Host "Token retrieved successfully!"
    $remoteUrl = "https://${token}@github.com/tokiyolifestyle/website.git"
    git push $remoteUrl main
} else {
    Write-Error "Could not retrieve token from Windows Credential Manager"
}
