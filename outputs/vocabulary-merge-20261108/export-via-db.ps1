$ErrorActionPreference='Stop'
$vocabSettings=@{}
Get-Content -LiteralPath "$PSScriptRoot/../../richy/richy-app/src/main/resources/application.properties" | ForEach-Object {
    if ($_ -match '^\s*(spring\.datasource\.(?:username|password))\s*=(.*)$') { $vocabSettings[$Matches[1]]=$Matches[2].Trim() }
}
$vocabConnectionSettings=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$vocabConnectionSettings['Data Source']='tcp:118.27.192.59,64573'
$vocabConnectionSettings['Initial Catalog']='ecommerce'
$vocabConnectionSettings['User ID']=$vocabSettings['spring.datasource.username']
$vocabConnectionSettings['Password']=$vocabSettings['spring.datasource.password']
$vocabConnectionSettings['Connect Timeout']=8
$vocabConnectionSettings['Application Name']='Codex vocabulary read-only export'
$vocabConnection=New-Object System.Data.SqlClient.SqlConnection($vocabConnectionSettings.ConnectionString)
try {
    $vocabConnection.Open()
    $vocabQuery=$vocabConnection.CreateCommand()
    $vocabQuery.CommandTimeout=45
    $vocabQuery.CommandText=Get-Content -LiteralPath "$PSScriptRoot/../../richy/database/vocabulary-duplicates-english-export.sql" -Raw
    $vocabReader=$vocabQuery.ExecuteXmlReader()
    $vocabWriter=[System.Xml.XmlWriter]::Create("$PSScriptRoot/english-duplicates.xml",(New-Object System.Xml.XmlWriterSettings -Property @{Indent=$true;Encoding=(New-Object System.Text.UTF8Encoding($false))}))
    try { $vocabWriter.WriteNode($vocabReader,$true) } finally { $vocabWriter.Dispose(); $vocabReader.Dispose() }
    Write-Output 'Saved read-only duplicate vocabulary export.'
} finally { $vocabConnection.Dispose() }
