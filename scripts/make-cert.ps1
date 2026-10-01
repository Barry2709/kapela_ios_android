New-Item -ItemType Directory -Force -Path certs
$cert = New-SelfSignedCertificate -Subject "CN=Sideload" -CertStoreLocation "Cert:\CurrentUser\My"
$pwd = ConvertTo-SecureString -String "1234" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "certs\dist.p12" -Password $pwd
