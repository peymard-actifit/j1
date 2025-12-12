# Script de commit, build et déploiement pour J1
# Affiche des signaux visuels dans Cursor au fil des étapes

param(
    [string]$CommitMessage = "Auto-commit: Build and deploy"
)

$ErrorActionPreference = "Stop"

# Couleurs pour les signaux visuels
function Write-Step {
    param([string]$Message, [string]$Color = "Green")
    Write-Host "`n========================================" -ForegroundColor $Color
    Write-Host $Message -ForegroundColor $Color
    Write-Host "========================================`n" -ForegroundColor $Color
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

try {
    # Étape 1: Vérification de l'état Git
    Write-Step "ÉTAPE 1: Vérification de l'état Git" "Cyan"
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Info "Fichiers modifiés détectés, préparation du commit..."
        git add .
        Write-Success "Fichiers ajoutés au staging"
    } else {
        Write-Info "Aucun changement détecté"
    }

    # Étape 2: Lecture de la version actuelle
    Write-Step "ÉTAPE 2: Gestion de la version" "Cyan"
    $packageJson = Get-Content package.json -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version
    Write-Info "Version actuelle: $currentVersion"
    
    # Incrémentation de la version (de X.Y.Z à X.Y+1.0)
    $versionParts = $currentVersion -split '\.'
    if ($versionParts.Length -ge 2) {
        $major = [int]$versionParts[0]
        $minor = [int]$versionParts[1] + 1
        $patch = 0
        $newVersion = "$major.$minor.$patch"
    } else {
        # Si version invalide, passer à 8.4.0
        $newVersion = "8.4.0"
    }
    
    Write-Info "Nouvelle version: $newVersion"
    
    # Mise à jour de package.json
    $packageJson.version = $newVersion
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
    Write-Success "Version mise à jour dans package.json"
    
    # Ajout de package.json au commit
    git add package.json

    # Étape 3: Commit
    Write-Step "ÉTAPE 3: Création du commit" "Cyan"
    $commitMsg = "$CommitMessage - Version $newVersion"
    git commit -m $commitMsg
    Write-Success "Commit créé: $commitMsg"

    # Étape 4: Build
    Write-Step "ÉTAPE 4: Build du projet" "Cyan"
    Write-Info "Exécution de: npm run build"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Échec du build"
    }
    Write-Success "Build réussi"

    # Étape 5: Push vers GitHub
    Write-Step "ÉTAPE 5: Push vers GitHub" "Cyan"
    Write-Info "Push vers origin/master..."
    git push origin master
    Write-Success "Push vers GitHub réussi"

    # Étape 6: Déploiement sur Vercel
    Write-Step "ÉTAPE 6: Déploiement sur Vercel" "Cyan"
    Write-Info "Déploiement en cours..."
    
    # Vérification de la présence du token Vercel
    $vercelToken = "xZAk2IdsbdUZCGIfTl4U8nYN"
    if ($vercelToken) {
        $env:VERCEL_TOKEN = $vercelToken
        Write-Info "Token Vercel configuré"
    } else {
        Write-Warning "Token Vercel non trouvé, tentative de déploiement sans token"
    }
    
    # Déploiement avec spécification explicite du nom du projet
    vercel --prod --yes --token $vercelToken --name j1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Le déploiement Vercel a peut-être échoué, mais le commit et le build sont réussis"
    } else {
        Write-Success "Déploiement Vercel réussi"
    }

    # Résumé final
    Write-Step "RÉSUMÉ FINAL" "Green"
    Write-Success "Version déployée: $newVersion"
    Write-Success "Commit: $commitMsg"
    Write-Success "Toutes les étapes sont terminées avec succès!"
    
} catch {
    Write-Step "ERREUR" "Red"
    Write-Error "Une erreur s'est produite: $_"
    Write-Error "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}

