//! Secrets (API keys, integration tokens) in Windows Credential Manager.
//!
//! Callers in this crate read them to make requests; no command ever hands a
//! secret back to the WebView.

#[cfg(target_os = "windows")]
mod imp {
    use windows::{
        core::{PCWSTR, PWSTR},
        Win32::{
            Foundation::FILETIME,
            Security::Credentials::{
                CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
                CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
            },
        },
    };

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn write(target: &str, secret: &str) -> Result<(), String> {
        let mut target_name = wide(target);
        let mut user_name = wide("Calendar");
        let blob = secret.as_bytes();

        let credential = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name.as_mut_ptr()),
            Comment: PWSTR::null(),
            LastWritten: FILETIME::default(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(user_name.as_mut_ptr()),
        };

        unsafe { CredWriteW(&credential, 0) }.map_err(|err| err.to_string())
    }

    pub fn read(target: &str) -> Option<String> {
        let target_name = wide(target);
        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            CredReadW(
                PCWSTR(target_name.as_ptr()),
                CRED_TYPE_GENERIC,
                0,
                &mut credential,
            )
            .ok()?;

            let bytes = std::slice::from_raw_parts(
                (*credential).CredentialBlob,
                (*credential).CredentialBlobSize as usize,
            );
            let secret = String::from_utf8(bytes.to_vec()).ok();
            CredFree(credential as *const _);
            secret
        }
    }

    pub fn delete(target: &str) -> Result<(), String> {
        let target_name = wide(target);
        unsafe { CredDeleteW(PCWSTR(target_name.as_ptr()), CRED_TYPE_GENERIC, 0) }
            .map_err(|err| err.to_string())
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    pub fn write(_target: &str, _secret: &str) -> Result<(), String> {
        Err("키 저장은 Windows에서만 지원합니다".into())
    }

    pub fn read(_target: &str) -> Option<String> {
        None
    }

    pub fn delete(_target: &str) -> Result<(), String> {
        Ok(())
    }
}

pub use imp::{delete, read, write};
