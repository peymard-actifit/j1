// Script pour mettre à jour le mot de passe d'un utilisateur dans localStorage
// Usage: Ouvrir la console du navigateur et exécuter ce code

function updateUserPassword(email, newPassword) {
  console.log('=== MISE À JOUR DU MOT DE PASSE ===\n');
  
  // Récupérer le cache utilisateur
  const cachedUserStr = localStorage.getItem('j1_current_user_cache');
  
  if (!cachedUserStr) {
    console.error('Aucun utilisateur en cache trouvé.');
    console.log('Création d\'un nouvel utilisateur...');
    
    // Créer un nouvel utilisateur
    const newUser = {
      id: Date.now().toString(),
      email: email,
      password: newPassword,
      name: email.split('@')[0],
      baseLanguage: 'fr',
      isAdmin: false,
      data: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    localStorage.setItem('j1_current_user_cache', JSON.stringify(newUser));
    localStorage.setItem('j1_current_user', newUser.id);
    
    console.log('✅ Nouvel utilisateur créé:');
    console.log('Email:', newUser.email);
    console.log('Mot de passe:', newUser.password);
    console.log('ID:', newUser.id);
    return;
  }
  
  try {
    const cachedUser = JSON.parse(cachedUserStr);
    
    // Vérifier si l'email correspond
    if (cachedUser.email.toLowerCase() !== email.toLowerCase()) {
      console.warn('⚠️ Email différent dans le cache:', cachedUser.email);
      console.log('Mise à jour de l\'email et du mot de passe...');
    }
    
    // Mettre à jour le mot de passe et l'email
    cachedUser.email = email;
    cachedUser.password = newPassword;
    cachedUser.updatedAt = new Date().toISOString();
    
    // Sauvegarder dans le cache
    localStorage.setItem('j1_current_user_cache', JSON.stringify(cachedUser));
    localStorage.setItem('j1_current_user', cachedUser.id);
    
    console.log('✅ Mot de passe mis à jour:');
    console.log('Email:', cachedUser.email);
    console.log('Nouveau mot de passe:', cachedUser.password);
    console.log('ID:', cachedUser.id);
    console.log('\nVous pouvez maintenant vous connecter avec ces identifiants.');
  } catch (e) {
    console.error('Erreur lors du parsing du cache:', e);
  }
}

// Exécuter la fonction avec les identifiants fournis
updateUserPassword('patrick.eymard@actifit.pro', 'Pat26rick_');
