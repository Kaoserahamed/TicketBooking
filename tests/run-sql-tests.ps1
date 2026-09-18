# =============================================================
# SQL Test Runner Script
# Reads the MySQL password from .env and runs every test SQL file
# in tests/sql/ against the target database.
#
# Usage:
#   .\tests\run-sql-tests.ps1                                  # run against an existing database
#   .\tests\run-sql-tests.ps1 -Fresh                           # recreate DB from schema.sql, then run
#   .\tests\run-sql-tests.ps1 -Fresh -Database ticket_booking_test
#
# Behaviour:
#   * Each .sql file is executed with `mysql --force` so that every error inside
#     the file is reported in a single pass. A file FAILS when mysql prints any
#     "ERROR <code>" line; SQL warnings are shown but do not fail the file.
#   * -Fresh drops and recreates the database from infrastructure/database/schema.sql,
#     which makes the suite repeatable (01-seed-data.sql expects an empty schema).
#   * Exit code 0 = every file passed, 1 = at least one failure (CI friendly).
# =============================================================

param(
    [string]$Database = "ticket_booking",
    # NOTE: $Host is a read-only automatic PowerShell variable, so the parameter is
    # named $DbHost and keeps "Host" as an alias for backwards compatibility.
    [Alias('Host')][string]$DbHost = "127.0.0.1",
    [string]$Port = "3306",
    [string]$User = "root",
    [switch]$Fresh
)

# mysql writes SQL errors to stderr; the runner detects them from the captured
# output (see Invoke-SqlFile) so they must not be promoted to terminating errors.
$ErrorActionPreference = "Continue"

$repoRoot   = Split-Path -Parent $PSScriptRoot
$envFile    = Join-Path $repoRoot ".env"
$schemaFile = Join-Path $repoRoot "infrastructure/database/schema.sql"

# Pipe SQL to mysql as UTF-8 (no BOM) so non-ASCII characters in comments survive
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

# -------------------------------------------------------------
# Read password from .env (DB_PASSWORD, fallback MY_SQL_PASSWORD)
# -------------------------------------------------------------
$password = $null
if (Test-Path $envFile) {
    foreach ($line in (Get-Content $envFile)) {
        if ($line -match '^\s*DB_PASSWORD\s*=\s*(.+?)\s*$') { $password = $Matches[1] }
    }
    if (-not $password) {
        foreach ($line in (Get-Content $envFile)) {
            if ($line -match '^\s*MY_SQL_PASSWORD\s*=\s*(.+?)\s*$') { $password = $Matches[1] }
        }
    }
}

if (-not $password) {
    Write-Error "Could not find DB_PASSWORD or MY_SQL_PASSWORD in $envFile"
    exit 1
}

# -------------------------------------------------------------
# Credentials are passed through a temporary option file instead of
# the command line (removes mysql's "password ... can be insecure"
# stderr warning and keeps the password out of the process list).
# -------------------------------------------------------------
$defaultsFile = Join-Path ([System.IO.Path]::GetTempPath()) "ticket-booking-my-$PID.cnf"
$defaultsText = "[client]`nuser=$User`npassword=$password`nhost=$DbHost`nport=$Port`n"
[System.IO.File]::WriteAllText($defaultsFile, $defaultsText, (New-Object System.Text.UTF8Encoding($false)))

# Run one SQL file through the mysql client and collect the outcome.
function Invoke-SqlFile {
    param(
        [string]$Path,
        [switch]$NoDatabase
    )

    $mysqlArgs = @("--defaults-extra-file=$defaultsFile", "--default-character-set=utf8mb4", "--force")
    if (-not $NoDatabase) { $mysqlArgs += $Database }

    $sql    = Get-Content $Path -Raw -Encoding UTF8
    $output = @($sql | & mysql @mysqlArgs 2>&1 | ForEach-Object { "$_" })

    return @{
        Lines    = $output
        ExitCode = $LASTEXITCODE
        Errors   = @($output | Where-Object { $_ -match 'ERROR \d+' })
        Warnings = @($output | Where-Object { $_ -match 'Warning \(Code' })
    }
}
# -------------------------------------------------------------
# Banner / connection check
# -------------------------------------------------------------
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Ticket Booking System - SQL Test Runner" -ForegroundColor Cyan
    Write-Host "  Database: $Database" -ForegroundColor Cyan
    Write-Host "  Server:   $DbHost`:$Port (user: $User)" -ForegroundColor Cyan
    Write-Host "  Mode:     $(if ($Fresh) { 'FRESH - database is recreated' } else { 'EXISTING database' })" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    if ($Fresh) {
        Write-Host "Recreating database '$Database'..." -ForegroundColor Yellow
        $resetSql = "DROP DATABASE IF EXISTS $Database; CREATE DATABASE $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        $resetOut = @($resetSql | & mysql "--defaults-extra-file=$defaultsFile" "--default-character-set=utf8mb4" 2>&1 | ForEach-Object { "$_" })
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to recreate database '$Database': $($resetOut -join ' | ')"
        }

        $schemaResult = Invoke-SqlFile -Path $schemaFile
        if ($schemaResult.ExitCode -ne 0 -or $schemaResult.Errors.Count -gt 0) {
            throw "Failed to load $schemaFile : $($schemaResult.Errors -join ' | ')"
        }
        Write-Host "  $schemaFile loaded" -ForegroundColor Green
        Write-Host ""
    }

    Write-Host "Verifying connection..." -ForegroundColor Yellow
    $checkSql = "SELECT '$Database' AS database_name, COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = '$Database';"
    $checkOut = @($checkSql | & mysql "--defaults-extra-file=$defaultsFile" "--default-character-set=utf8mb4" "--table" 2>&1 | ForEach-Object { "$_" })
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot connect to MySQL or database '$Database'. Output: $($checkOut -join ' | ')"
    }
    $checkOut | ForEach-Object { Write-Host "  $_" }
    Write-Host ""

    # ---------------------------------------------------------
    # Test files, in execution order
    # ---------------------------------------------------------
    $testFiles = @(
        @{ Name = "Seed Data";            Path = "tests/sql/01-seed-data.sql" },
        @{ Name = "User & Auth Queries";  Path = "tests/sql/02-user-auth-queries.sql" },
        @{ Name = "Event Queries";        Path = "tests/sql/03-event-queries.sql" },
        @{ Name = "Venue & Seat Queries"; Path = "tests/sql/04-venue-seat-queries.sql" },
        @{ Name = "Show Queries";         Path = "tests/sql/05-show-queries.sql" },
        @{ Name = "Availability Queries"; Path = "tests/sql/06-availability-queries.sql" },
        @{ Name = "Booking Flow";         Path = "tests/sql/07-booking-flow.sql" },
        @{ Name = "Payment Queries";      Path = "tests/sql/08-payment-queries.sql" },
        @{ Name = "Ticket Queries";       Path = "tests/sql/09-ticket-queries.sql" },
        @{ Name = "Admin Reports";        Path = "tests/sql/10-admin-reports.sql" },
        @{ Name = "Concurrency Tests";    Path = "tests/sql/11-concurrency-tests.sql" },
        @{ Name = "Background Worker";    Path = "tests/sql/12-background-worker.sql" }
    )

    $totalPassed = 0
    $totalFailed = 0
    $results     = @()

    foreach ($test in $testFiles) {
        $fileDesc = $test.Name
        $filePath = Join-Path $repoRoot $test.Path

        if (-not (Test-Path $filePath)) {
            Write-Host "SKIP: $fileDesc - file not found ($filePath)" -ForegroundColor DarkYellow
            $results += [PSCustomObject]@{ Test = $fileDesc; Status = "SKIP"; Errors = "-"; Warnings = "-" }
            continue
        }

        Write-Host "RUNNING: $fileDesc" -ForegroundColor Green -NoNewline
        $run = Invoke-SqlFile -Path $filePath

        if ($run.Errors.Count -eq 0 -and $run.ExitCode -eq 0) {
            $totalPassed++
            Write-Host " -> PASS ($($run.Warnings.Count) warnings)" -ForegroundColor Green
            $results += [PSCustomObject]@{ Test = $fileDesc; Status = "PASS"; Errors = 0; Warnings = $run.Warnings.Count }
        }
        else {
            $totalFailed++
            Write-Host " -> FAIL ($($run.Errors.Count) errors)" -ForegroundColor Red
            $run.Errors | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
            $results += [PSCustomObject]@{ Test = $fileDesc; Status = "FAIL"; Errors = $run.Errors.Count; Warnings = $run.Warnings.Count }
        }

        if ($run.Warnings.Count -gt 0) {
            $run.Warnings | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
        }

        if ($run.Errors -match 'Duplicate entry') {
            Write-Host "    HINT: database already contains seeded data - re-run with -Fresh to reset it." -ForegroundColor DarkYellow
        }
    }

    # ---------------------------------------------------------
    # Summary
    # ---------------------------------------------------------
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Test Results Summary" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Passed: $totalPassed" -ForegroundColor Green
    Write-Host "  Failed: $totalFailed" -ForegroundColor Red
    Write-Host "  Total:  $($totalPassed + $totalFailed)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $results | Format-Table -AutoSize

    if ($totalFailed -gt 0) { exit 1 }
    exit 0
}
finally {
    Remove-Item $defaultsFile -Force -ErrorAction SilentlyContinue
}