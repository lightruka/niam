const SUPABASE_URL = 'https://djceirgdjudaqxhdqlvg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqY2VpcmdkanVkYXF4aGRxbHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjU1NjksImV4cCI6MjA5MTk0MTU2OX0._B7ejOaEMatK3Qqiboe-bV_dXORSsfDwzouC8bRJBgE';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    // ---- Supabase Auth Logic ----
    const authForm = document.getElementById('auth-form');
    // authEmail n'est plus pré-déclaré ici pour éviter les erreurs si l'élément change d'ID

    // 1. Vérifier la session au démarrage
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        handleSessionState(session);
    });

    // 2. Écouter les changements en direct (quand on clique sur le lien mail)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            handleSessionState(session);
            // Nettoyer l'URL pour enlever le token
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (event === 'SIGNED_OUT') {
            handleSessionState(null);
        }
    });

    // 3. Fonction pour basculer l'affichage (Gatekeeper avec Onboarding)
    async function handleSessionState(session) {
        const authView = document.getElementById('view-auth');
        const onboardingView = document.getElementById('view-onboarding');
        const generatorView = document.getElementById('view-generator');
        const bottomNav = document.getElementById('bottom-nav');

        if (session) {
            // Utilisateur connecté : On vérifie si le profil existe
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                // Synchronisation avec le LocalStorage
                const localData = JSON.parse(localStorage.getItem('antiGaspiProfile') || '{}');
                localStorage.setItem('antiGaspiProfile', JSON.stringify({
                    ...localData,
                    username: profile.username,
                    preferences: profile.preferences || [],
                    avatar_url: profile.avatar_url
                }));

                // Mets à jour l'interface avec les nouvelles données
                if (typeof loadProfileData === 'function') loadProfileData();

                // Profil existant -> Go vers le Générateur
                if(authView) authView.classList.remove('active');
                if(onboardingView) onboardingView.classList.remove('active');
                if(generatorView) generatorView.classList.add('active');
                if(bottomNav) bottomNav.classList.remove('hidden');
                
                loadRecipesFromCloud(); 
            } else {
                // Pas de profil -> Go vers Onboarding
                if(authView) authView.classList.remove('active');
                if(generatorView) generatorView.classList.remove('active');
                if(onboardingView) onboardingView.classList.add('active');
                if(bottomNav) bottomNav.classList.add('hidden');

                // Initialiser le Wizard sur l'étape 1
                const steps = document.querySelectorAll('.onboarding-step');
                steps.forEach(s => s.classList.add('right'));
                const firstStep = document.getElementById('ob-step-1');
                if(firstStep) {
                    firstStep.classList.remove('right');
                    firstStep.classList.add('active');
                }
            }
        } else {
            // Déconnecté : on force Auth
            document.querySelectorAll('.view').forEach(v => {
                v.classList.remove('active', 'animating');
            });
            if(authView) authView.classList.add('active');
            if(bottomNav) bottomNav.classList.add('hidden');
        }
    }

    // 4. Logique de l'Onboarding (Wizard Multi-Étapes)
    const onboardingWizard = document.getElementById('onboarding-wizard');
    const onboardingDiets = document.querySelectorAll('#onboarding-diets .pref-badge');
    const onboardingSubmit = document.getElementById('onboarding-submit');
    const onboardingUsername = document.getElementById('onboarding-username');
    const nextBtns = document.querySelectorAll('.next-step');
    const prevBtns = document.querySelectorAll('.prev-step');
    const summaryText = document.getElementById('onboarding-summary-text');

    function goToStep(stepNum, direction = 'forward') {
        const steps = document.querySelectorAll('.onboarding-step');
        const currentActive = document.querySelector('.onboarding-step.active');
        const nextStep = document.getElementById(`ob-step-${stepNum}`);

        if (!nextStep) return;

        // Validation simple
        if (stepNum === 2 && direction === 'forward') {
            const name = onboardingUsername.value.trim();
            if (!name) {
                showToast("Dites-nous votre nom, Chef ! 👨‍🍳");
                return;
            }
            if (summaryText) {
                summaryText.textContent = `Excellent ${name} ! On fonce ?`;
            }
        }

        // Gérer les classes d'animation
        steps.forEach(step => {
            if (step === nextStep) {
                step.className = 'onboarding-step active';
            } else if (step === currentActive) {
                step.className = direction === 'forward' ? 'onboarding-step left' : 'onboarding-step right';
            } else {
                // Maintenir les autres étapes à leur position logique
                const sNum = parseInt(step.id.split('-').pop());
                if (sNum < stepNum) step.className = 'onboarding-step left';
                else if (sNum > stepNum) step.className = 'onboarding-step right';
            }
        });
    }

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = btn.dataset.next;
            goToStep(parseInt(nextStep), 'forward');
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = btn.dataset.prev;
            goToStep(parseInt(prevStep), 'backward');
        });
    });

    onboardingDiets.forEach(badge => {
        badge.addEventListener('click', () => {
            if (badge.dataset.diet === 'None') {
                onboardingDiets.forEach(b => b.classList.remove('active'));
                badge.classList.add('active');
            } else {
                const noneBadge = Array.from(onboardingDiets).find(b => b.dataset.diet === 'None');
                if (noneBadge) noneBadge.classList.remove('active');
                badge.classList.toggle('active');
            }
        });
    });

    if (onboardingSubmit) {
        onboardingSubmit.addEventListener('click', async () => {
            const username = onboardingUsername.value.trim();
            const selectedDiets = Array.from(document.querySelectorAll('#onboarding-diets .pref-badge.active'))
                                      .map(b => b.dataset.diet);

            onboardingSubmit.disabled = true;
            onboardingSubmit.querySelector('.btn-content').textContent = "C'est parti...";

            const { data: { user } } = await supabaseClient.auth.getUser();

            const { error } = await supabaseClient
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: username,
                    preferences: selectedDiets,
                    avatar_url: null
                });

            if (error) {
                showToast("Erreur : " + error.message);
                onboardingSubmit.disabled = false;
                onboardingSubmit.querySelector('.btn-content').textContent = "Recommencer 🚀";
            } else {
                showToast(`Bon appétit, Chef ${username} ! 🚀`);
                
                // Sauvegarde de sécurité dans le LocalStorage
                const localData = JSON.parse(localStorage.getItem('antiGaspiProfile') || '{}');
                localStorage.setItem('antiGaspiProfile', JSON.stringify({
                    ...localData,
                    username: username,
                    preferences: selectedDiets
                }));

                // Force Reload pour réinitialiser l'état et charger le générateur
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        });
    }

    if (supabaseClient && authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email-input');
            const submitBtn = document.getElementById('login-btn');
            const authMessage = document.getElementById('auth-message');
            
            if (!emailInput || !submitBtn || !authMessage) return;

            const email = emailInput.value.trim();
            
            submitBtn.disabled = true;
            submitBtn.textContent = "Envoi en cours...";
            authMessage.className = ''; // Reset classes (success, error)
            authMessage.textContent = "Préparation de votre lien magique...";

            const { error } = await supabaseClient.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: window.location.href }
            });

            if (error) {
                showToast("❌ Erreur : " + error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = "Réessayer";
                authMessage.textContent = "Erreur : " + error.message;
                authMessage.classList.add('error');
            } else {
                showToast("📩 Lien envoyé !");
                submitBtn.textContent = "Lien envoyé !";
                authMessage.textContent = "Lien envoyé ! Vérifiez votre boîte mail (et vos spams).";
                authMessage.classList.add('success');
            }
        });
    }

    function switchToView(tabName) {
        const targetView = document.getElementById(`view-${tabName}`);
        const targetNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'animating'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        if (targetView) targetView.classList.add('active');
        if (targetNavItem) targetNavItem.classList.add('active');
    }

    // ---- DOM Elements ----
    const mealCount     = document.getElementById('meal-count');
    const btnMinus      = document.getElementById('btn-minus');
    const btnPlus       = document.getElementById('btn-plus');
    const badges        = document.querySelectorAll('.badge');
    const generateBtn   = document.getElementById('generate-btn');
    const btnContent    = generateBtn.querySelector('.btn-content');
    const btnLoading    = generateBtn.querySelector('.btn-loading');
    const resultsSection= document.getElementById('results-section');
    const navItems      = document.querySelectorAll('.nav-item');
    const cameraBtn     = document.getElementById('camera-btn');

    let meals = 2;
    const MIN_MEALS = 1;
    const MAX_MEALS = 10;

    // ---- Meal Counter ----
    function updateCounter() {
        mealCount.textContent = meals;
        btnMinus.style.opacity = meals <= MIN_MEALS ? '.4' : '1';
        btnMinus.disabled = meals <= MIN_MEALS;
    }

    btnMinus.addEventListener('click', () => {
        if (meals > MIN_MEALS) {
            meals--;
            mealCount.style.transform = 'scale(.7)';
            setTimeout(() => mealCount.style.transform = 'scale(1)', 150);
            updateCounter();
        }
    });

    btnPlus.addEventListener('click', () => {
        if (meals < MAX_MEALS) {
            meals++;
            mealCount.style.transform = 'scale(1.3)';
            setTimeout(() => mealCount.style.transform = 'scale(1)', 150);
            updateCounter();
        }
    });

    mealCount.style.transition = 'transform .15s cubic-bezier(.4,0,.2,1)';

    // ---- Custom Select Logic ----
    const customTimeSelect = document.getElementById('custom-time-select');
    if (customTimeSelect) {
        const trigger = customTimeSelect.querySelector('.select-trigger');
        const selectedValue = customTimeSelect.querySelector('.selected-value');
        const options = customTimeSelect.querySelectorAll('.select-option');
        const hiddenInput = document.getElementById('prep-time');

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customTimeSelect.classList.toggle('open');
        });

        // Handle option selection
        options.forEach(option => {
            option.addEventListener('click', () => {
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                // Keep the text without the emoji for the summary if we want, but keeping full text is okay
                selectedValue.textContent = option.textContent;
                hiddenInput.value = option.dataset.value;
                
                customTimeSelect.classList.remove('open');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!customTimeSelect.contains(e.target)) {
                customTimeSelect.classList.remove('open');
            }
        });
    }

    // ---- Diet Badges Toggle ----
    badges.forEach(badge => {
        badge.addEventListener('click', () => {
            badge.classList.toggle('active');
        });
    });

    // ---- Setup Toast ----
    const toast = document.getElementById('toast');
    function showToast(msg) {
        if(!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ---- Markdown Bold Parser Util ----
    function parseMarkdownBold(text) {
        if (!text) return "";
        // Replace **text** with <strong>text</strong> - handles multiple lines and spacing
        return text.replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
    }

    // ---- Generate Button (Gemini AI) ----
    generateBtn.addEventListener('click', async () => {
        // Form Validation
        const ingredientsInput = document.getElementById('ingredients-input');
        if (!ingredientsInput.value.trim()) {
            ingredientsInput.classList.add('shake-error');
            setTimeout(() => ingredientsInput.classList.remove('shake-error'), 400); 
            showToast("Veuillez indiquer ce qu'il vous reste !");
            return;
        }

        // Collect user data
        const ingredientsText = ingredientsInput.value.trim();
        const pTime = document.getElementById('prep-time').value || "30";
        const dietLabels = Array.from(document.querySelectorAll('#view-generator .badge.active')).map(b => b.textContent.trim());

        // Merge with Profile Data
        const profileData = JSON.parse(localStorage.getItem('antiGaspiProfile') || '{}');
        const userDiets = profileData.preferences || [];
        const allDiets = [...new Set([...dietLabels, ...userDiets])];
        const difficulty = profileData.difficulty || 'moyen';
        const isBudget = profileData.budgetToggle;
        const eqp = profileData.equipment || [];
        const username = profileData.username || '';

        // Switch to loading state
        generateBtn.classList.add('loading');
        btnContent.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        
        // Hide previous results
        resultsSection.classList.add('hidden');

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ingredientsText,
                    pTime,
                    allDiets,
                    difficulty,
                    isBudget,
                    eqp
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erreur serveur");
            }

            const recipeData = await response.json();


            // Restore button
            generateBtn.classList.remove('loading');
            btnContent.classList.remove('hidden');
            btnLoading.classList.add('hidden');

            // Render output with REAL data
            renderGeminiResults(recipeData, meals, username);

        } catch (err) {
            console.error("Gemini Error:", err);
            generateBtn.classList.remove('loading');
            btnContent.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            showToast("Oups ! Niam ! a eu un souci de connexion. Réessayez ?");
        }
    });

    // ---- Dynamic Rendering of Gemini AI Response ----
    function renderGeminiResults(data, numMeals, username) {
        if (!data || !data.titre) return;

        // Extract clean data
        const title = data.titre;
        const timeStr = data.temps || "20 min";
        const calStr = data.calories || "350 kcal";
        const steps = data.etapes || [];
        const missing = data.courses_manquantes || [];

        let stepsHtml = '';
        steps.forEach((step, idx) => {
            stepsHtml += `
                <li>
                    <span class="step-number">${idx + 1}</span>
                    <span class="step-text">${parseMarkdownBold(step)}</span>
                </li>
            `;
        });

        let shoppingHtml = '';
        if (missing.length === 0) {
            shoppingHtml = '<p style="padding:10px 0; font-size:.9rem; color:var(--clr-accent);">Rien du tout ! Vous avez tout ce qu\'il faut. 🎉</p>';
        } else {
            missing.forEach((item, idx) => {
                shoppingHtml += `
                    <li class="shopping-item">
                        <label class="checkbox-wrapper">
                            <input type="checkbox" id="item-${idx}">
                            <span class="custom-checkbox"></span>
                            <span class="item-text">${item}</span>
                        </label>
                        <span class="item-qty">1</span>
                    </li>
                `;
            });
        }

        const chefName = username ? `Chef ${username}` : "Niam !";

        resultsSection.innerHTML = `
            <!-- Menu Card -->
            <div class="result-card menu-card animate-in" id="menu-card" style="animation-delay: 0s;">
                <div class="card-header">
                    <div class="card-header-icon">🍽️</div>
                    <div>
                        <h2 class="card-title">Votre Menu</h2>
                        <p class="card-subtitle">Généré pour ${chefName}</p>
                    </div>
                </div>
                
                <div class="recipe" id="recipe-active">
                    <div class="recipe-header">
                        <h3 class="recipe-name">${title}</h3>
                        <div class="header-actions">
                            <button class="share-btn" id="share-btn-active" aria-label="Partager la recette">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                                </svg>
                            </button>
                            <button class="fav-btn" id="fav-btn-active" aria-label="Ajouter aux favoris">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="recipe-meta">
                        <span class="meta-tag" data-val="${calStr}"><span class="meta-icon">🔥</span> ${calStr}</span>
                        <span class="meta-tag" data-val="${timeStr}"><span class="meta-icon">⏱️</span> ${timeStr}</span>
                        <span class="meta-tag"><span class="meta-icon">👥</span> 2 pers.</span>
                    </div>
                    <div class="recipe-steps">
                        <div class="steps-header" id="steps-toggle">
                            <h4 class="steps-title">Étapes de préparation</h4>
                            <span class="steps-chevron">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </span>
                        </div>
                        <ol class="steps-list" id="steps-list">
                            ${stepsHtml}
                        </ol>
                    </div>
                </div>
            </div>

            <!-- Shopping List Card -->
            <div class="result-card shopping-card animate-in" id="shopping-card" style="animation-delay: 0.15s;">
                <div class="card-header">
                    <div class="card-header-icon">🛒</div>
                    <div>
                        <h2 class="card-title">Liste de courses</h2>
                        <p class="card-subtitle">Articles manquants suggérés</p>
                    </div>
                </div>
                <ul class="shopping-list" id="shopping-list">
                    ${shoppingHtml}
                </ul>
                <div class="shopping-footer">
                    <span class="items-done" id="items-done">0 / ${missing.length} achetés</span>
                </div>
            </div>

            <!-- Eco tip -->
            <div class="eco-tip animate-in" id="eco-tip" style="animation-delay: 0.3s;">
                <span class="eco-icon">💡</span>
                <p>En utilisant vos restes, vous évitez de gaspiller environ <strong>${(numMeals * 0.4).toFixed(1)} kg</strong> de nourriture cette semaine. Bravo !</p>
            </div>
        `;

        resultsSection.classList.remove('hidden');

        // ==== HISTORY SAVING (CLOUD) ====
        const fullHtml = resultsSection.innerHTML;
        
        saveRecipeToCloud({
            title: title,
            html: fullHtml
        }).then(() => {
            loadRecipesFromCloud(); // Refresh history view
        });
        
        // Auto-navigate to history to see the result
        setTimeout(() => {
            const navHist = document.getElementById('nav-history');
            if (navHist) navHist.click();
        }, 150);
    }


    // ---- Favorites Storage & Rendering ----
    const favoritesContainer = document.getElementById('favorites-container');
    
    function getFavorites() {
        return JSON.parse(localStorage.getItem('antiGaspiFavorites') || '[]');
    }

    function saveFavorites(favs) {
        localStorage.setItem('antiGaspiFavorites', JSON.stringify(favs));
    }

    function toggleFavorite(recipeDiv, forceState = null) {
        const title = recipeDiv.querySelector('.recipe-name').textContent.trim();
        let favs = getFavorites();
        
        const existingIdx = favs.findIndex(f => f.id === title);
        const isActive = forceState !== null ? forceState : existingIdx === -1;
        
        if (!isActive && existingIdx >= 0) {
            // Remove from array
            favs.splice(existingIdx, 1);
            recipeDiv.querySelector('.fav-btn').classList.remove('active');
        } else if (isActive && existingIdx === -1) {
            // Clone content to save in favorites
            const clonedDiv = recipeDiv.cloneNode(true);
            clonedDiv.querySelector('.fav-btn').classList.add('active'); 
            
            favs.push({
                id: title,
                html: clonedDiv.innerHTML
            });
            recipeDiv.querySelector('.fav-btn').classList.add('active');
        }
        
        saveFavorites(favs);
        renderFavorites();
    }

    function renderFavorites() {
        const favs = getFavorites();
        if(favs.length === 0) {
            if (favoritesContainer) {
                favoritesContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">❤️</div>
                        <h3>Aucun favori pour le moment</h3>
                        <p>Vos recettes sauvegardées apparaîtront ici.</p>
                    </div>
                `;
            }
            return;
        }

        let html = '<div class="result-card menu-card" style="margin-top: 16px;">';
        favs.forEach((fav, index) => {
            html += `
                <div class="recipe" data-favid="${fav.id}">
                    ${fav.html}
                </div>
                ${index < favs.length - 1 ? '<hr class="recipe-divider">' : ''}
            `;
        });
        html += '</div>';
        if (favoritesContainer) {
            favoritesContainer.innerHTML = html;
        }
    }

    // ---- History Storage & Rendering ----
    const historyListContainer = document.getElementById('history-list');

    function renderHistoryList() {
        if (!historyListContainer) return;
        const history = JSON.parse(localStorage.getItem('antiGaspiHistory') || '[]');
        
        const resultsSectionElement = document.getElementById('results-section');

        if (history.length === 0) {
            if (resultsSectionElement) {
                resultsSectionElement.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🍳</div>
                        <h3>Prêt à cuisiner ?</h3>
                        <p>Vos délicieuses créations apparaîtront ici.</p>
                    </div>
                `;
                resultsSectionElement.classList.remove('hidden');
            }
            historyListContainer.innerHTML = '<p style="text-align:center; color:var(--clr-text-muted); font-size:.9rem; margin-top:20px;">Aucune archive.</p>';
            return;
        }

        // 1. Render Active/Index 0 in Results Section
        if (resultsSectionElement) {
            resultsSectionElement.innerHTML = history[0].html;
            resultsSectionElement.classList.remove('hidden');
        }

        // 2. Render Previous Items (index 1+) in History List Section
        let html = '';
        const prevRecipes = history.slice(1);
        
        if (prevRecipes.length === 0) {
            historyListContainer.innerHTML = '<p style="text-align:center; color:var(--clr-text-muted); font-size:.85rem; padding: 20px 0;">C\'était votre première recette ! ✨</p>';
        } else {
            prevRecipes.forEach(h => {
                html += `
                    <div class="history-item" data-id="${h.id}">
                        <div class="history-info">
                            <span class="history-icon-small">🍱</span>
                            <div class="history-text-wrapper">
                                <span class="history-title">${h.title}</span>
                                <div class="history-meta">
                                    <span>${h.date}</span>
                                    <span class="history-bullet">•</span>
                                    <span class="history-calories">${h.calories}</span>
                                </div>
                            </div>
                        </div>
                        <div class="history-chevron">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                    </div>
                `;
            });
            historyListContainer.innerHTML = html;
        }
    }

    if (historyListContainer) {
        historyListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (item) {
                const id = item.getAttribute('data-id');
                let history = JSON.parse(localStorage.getItem('antiGaspiHistory') || '[]');
                
                const targetIdx = history.findIndex(h => h.id === id);
                if (targetIdx !== -1) {
                    // Make it the active one at index 0
                    const selected = history.splice(targetIdx, 1)[0];
                    history.unshift(selected); 
                    localStorage.setItem('antiGaspiHistory', JSON.stringify(history));
                    
                    // Reload UI
                    const resultsSectionElement = document.getElementById('results-section');
                    resultsSectionElement.innerHTML = selected.html;
                    resultsSectionElement.classList.remove('hidden');
                    
                    // Re-run animations smoothly
                    const cards = resultsSectionElement.querySelectorAll('.result-card, .eco-tip');
                    cards.forEach(c => {
                        c.style.animation = 'none';
                        c.offsetHeight;
                        c.style.animation = null;
                    });

                    renderHistoryList();
                    updateProfileStats();
                    
                    // Smooth scroll to top to see the loaded recipe
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });
    }

    // Call it on init
    renderHistoryList();

    // Delegation in Results View
    resultsSection.addEventListener('click', (e) => {
        const favBtn = e.target.closest('.fav-btn');
        if (favBtn) {
            const recipeDiv = favBtn.closest('.recipe');
            if(recipeDiv) toggleFavorite(recipeDiv);
        }

        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const recipeDiv = shareBtn.closest('.recipe');
            if(recipeDiv) shareRecipe(recipeDiv);
        }
    });

    async function shareRecipe(recipeDiv) {
        const title = recipeDiv.querySelector('.recipe-name').textContent.trim();
        const cal = recipeDiv.querySelector('.meta-tag[data-val*="kcal"]')?.dataset.val || "";
        const time = recipeDiv.querySelector('.meta-tag[data-val*="min"]')?.dataset.val || "";
        
        const shareData = {
            title: `Recette Anti-Gaspi : ${title}`,
            text: `Regarde cette recette anti-gaspi générée par Niam ! 🍳 : ${title}. Temps : ${time}. Calories : ${cal}.`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback for desktop or non-supported browsers
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                showToast("Lien copié dans le presse-papier !");
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast("Erreur lors du partage.");
                console.error("Share error:", err);
            }
        }
    }

    resultsSection.addEventListener('change', (e) => {
        // Handle Shopping Checkboxes
        if (e.target.matches('.shopping-list input[type="checkbox"]')) {
            updateShoppingCount();
        }
    });

    // Delegation in Favorites View
    if (favoritesContainer) {
        favoritesContainer.addEventListener('click', (e) => {
            const favBtn = e.target.closest('.fav-btn');
            if (favBtn) {
                const recipeDiv = favBtn.closest('.recipe');
                if(recipeDiv) {
                    const title = recipeDiv.querySelector('.recipe-name').textContent.trim();
                    toggleFavorite(recipeDiv, false); // force removal
                    
                    // Also untoggle in generator if visible
                    const generatorMatches = resultsSection.querySelectorAll('.recipe');
                    generatorMatches.forEach(rec => {
                        if(rec.querySelector('.recipe-name').textContent.trim() === title) {
                            rec.querySelector('.fav-btn').classList.remove('active');
                        }
                    });
                }
            }
        });
    }

    renderFavorites(); // Init favorites on load

    function updateShoppingCount() {
        const checkboxes = resultsSection.querySelectorAll('.shopping-list input[type="checkbox"]');
        if (!checkboxes.length) return;
        
        const total = checkboxes.length;
        const checked = resultsSection.querySelectorAll('.shopping-list input:checked').length;
        const itemsDoneText = resultsSection.querySelector('#items-done');
        
        if (!itemsDoneText) return;
        
        itemsDoneText.textContent = `${checked} / ${total} achetés`;

        if (checked === total && total > 0) {
            itemsDoneText.style.color = '#5A9E6F';
            itemsDoneText.textContent += ' ✓';
        } else {
            itemsDoneText.style.color = '';
        }
    }

    // ---- Camera Modal Logic ----
    const cameraModal = document.getElementById('camera-modal');
    const cameraVideo = document.getElementById('camera-feed');
    const cameraCanvas = document.getElementById('camera-canvas');
    const closeCameraBtn = document.getElementById('camera-close-btn');
    const snapBtn = document.getElementById('snap-btn');
    const cameraState = document.getElementById('camera-state');
    const ingredientsInput = document.getElementById('ingredients-input');
    
    let cameraStream = null;

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        if (cameraVideo) {
            cameraVideo.srcObject = null;
        }
    }

    cameraBtn.addEventListener('click', async () => {
        cameraBtn.style.transform = 'scale(.85)';
        setTimeout(() => cameraBtn.style.transform = 'scale(1)', 200);

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            cameraVideo.srcObject = cameraStream;
            cameraModal.classList.remove('hidden');
            document.body.classList.add('camera-open');
        } catch (err) {
            console.error("Camera error:", err);
            alert("Impossible d'accéder à la caméra. Vérifiez les permissions de votre navigateur.");
        }
    });

    if (closeCameraBtn) {
        closeCameraBtn.addEventListener('click', () => {
            stopCamera();
            cameraModal.classList.add('hidden');
            cameraState.classList.add('hidden');
            document.body.classList.remove('camera-open');
        });
    }

    if (snapBtn) {
        snapBtn.addEventListener('click', () => {
            if (!cameraStream) return;
            
            // Visual Flash Effect
            const flash = document.getElementById('camera-flash');
            if (flash) {
                flash.classList.add('active');
                setTimeout(() => flash.classList.remove('active'), 50);
            }

            // Pause video to "freeze" the frame visually
            cameraVideo.pause();

            // Show AI Loading State
            cameraState.classList.remove('hidden');

            // Simulate AI Processing
            setTimeout(() => {
                // Resume and stop safely
                cameraVideo.play().catch(e => { /* ignore */ });
                stopCamera();
                cameraModal.classList.add('hidden');
                cameraState.classList.add('hidden');
                document.body.classList.remove('camera-open');
                
                // Set mocked ingredients
                const mockedIngredients = "3 œufs, la moitié d'un poivron rouge, un reste de poulet rôti et un peu de fromage râpé";

                if (ingredientsInput.value.trim() === "") {
                    ingredientsInput.value = mockedIngredients;
                } else {
                    ingredientsInput.value += ", " + mockedIngredients;
                }
                
                // Trigger auto-resize
                ingredientsInput.dispatchEvent(new Event('input'));
            }, 2500); 
        });
    }
    // ---- Gallery Import Simulation ----
    const galleryBtn = document.getElementById('gallery-btn');
    const galleryInput = document.getElementById('gallery-input');
    
    if (galleryBtn && galleryInput) {
        galleryBtn.addEventListener('click', () => galleryInput.click());
        
        galleryInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                // Show AI Loading State
                cameraState.classList.remove('hidden');

                // Simulate AI Processing (same as camera)
                setTimeout(() => {
                    cameraState.classList.add('hidden');
                    const mockedIngredients = "3 œufs, la moitié d'un poivron rouge, un reste de poulet rôti et un peu de fromage râpé";
                    if (ingredientsInput.value.trim() === "") {
                        ingredientsInput.value = mockedIngredients;
                    } else {
                        ingredientsInput.value += ", " + mockedIngredients;
                    }
                    ingredientsInput.dispatchEvent(new Event('input'));
                    showToast("Image analysée avec succès !");
                }, 2000);
            }
        });
    }

    // ---- Accordion Toggle Logic ----
    // Delegated to resultsSection since it's dynamic
    resultsSection.addEventListener('click', (e) => {
        const stepsHeader = e.target.closest('.steps-header');
        if (stepsHeader) {
            stepsHeader.classList.toggle('collapsed');
        }
    });

    // ---- Bottom Navigation & Views ----
    const views = document.querySelectorAll('.view');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            const targetView = document.getElementById(`view-${targetTab}`);
            
            if (item.classList.contains('active')) return;

            // Immediate Tactile Feedback
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Optimized View Switching
            views.forEach(view => {
                if (view === targetView) {
                    // 1. Prepare for GPU acceleration
                    view.style.willChange = 'opacity, transform';
                    
                    // 2. Show the element (display: block) without animation yet
                    view.classList.add('animating');
                    
                    // 3. Double rAF to ensure display:block has been painted, then trigger animation
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            view.classList.add('active');
                        });
                    });

                    // 4. Cleanup memory after transition
                    const cleanup = (e) => {
                        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
                            view.style.willChange = 'auto';
                            view.classList.remove('animating');
                            view.removeEventListener('transitionend', cleanup);
                        }
                    };
                    view.addEventListener('transitionend', cleanup);
                } else {
                    // Instantly hide other views
                    view.classList.remove('active', 'animating');
                    view.style.willChange = 'auto';
                }
            });

            // Fast scroll to top
            window.scrollTo(0, 0);
        });
    });

    // ---- Textarea Auto-resize ----
    const textarea = document.getElementById('ingredients-input');
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    });

    // ---- Profile & Settings Management ----
    const usernameInput = document.getElementById('username-input');
    const profileDifficulty = document.getElementById('profile-difficulty');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const budgetToggle = document.getElementById('budget-toggle');
    const gridBtns = document.querySelectorAll('.grid-btn');
    const prefBadges = document.querySelectorAll('#profile-diets .pref-badge');
    const resetBtn = document.getElementById('reset-data-btn');

    function loadProfileData() {
        const data = JSON.parse(localStorage.getItem('antiGaspiProfile') || '{}');
        
        if (data.username) usernameInput.value = data.username;
        if (data.difficulty) profileDifficulty.value = data.difficulty;
        if (data.darkMode) {
            darkModeToggle.checked = true;
            document.body.classList.add('dark-mode');
        }
        if (data.budgetToggle) budgetToggle.checked = true;
        
        if (data.preferences) {
            prefBadges.forEach(btn => {
                const diet = btn.textContent.trim();
                if (data.preferences.includes(diet)) btn.classList.add('active');
            });
        }

        if (data.avatar_url) {
            const img = document.getElementById('avatar-img');
            const emoji = document.getElementById('avatar-emoji');
            if (img && emoji) {
                img.src = data.avatar_url;
                img.classList.remove('hidden');
                emoji.classList.add('hidden');
            }
        }
        
        if (data.equipment) {
            gridBtns.forEach(btn => {
                if (data.equipment.includes(btn.dataset.equip)) btn.classList.add('active');
            });
        }
        
        if (data.preferences) {
            // Switches in Profile
            const prefSwitches = document.querySelectorAll('.pref-switch');
            prefSwitches.forEach(sw => {
                if (data.preferences.includes(sw.dataset.diet)) sw.checked = true;
            });
            
            // Sync with Generator badges
            badges.forEach(badge => {
                if (data.preferences.includes(badge.textContent.trim())) {
                    badge.classList.add('active');
                }
            });
        }

        updateProfileStats();
    }

    function updateProfileStats() {
        const history = JSON.parse(localStorage.getItem('antiGaspiHistory') || '[]');
        const statsCount = document.getElementById('stats-count');
        const statsSaved = document.getElementById('stats-saved');
        
        if (statsCount) statsCount.textContent = history.length;
        if (statsSaved) statsSaved.textContent = (history.length * 0.3).toFixed(1);
    }

    function saveProfileData() {
        const activeEquip = Array.from(document.querySelectorAll('.grid-btn.active')).map(b => b.dataset.equip);
        const activePrefs = Array.from(document.querySelectorAll('.pref-switch:checked')).map(b => b.dataset.diet);
        
        const data = {
            username: usernameInput.value.trim(),
            difficulty: profileDifficulty.value,
            darkMode: darkModeToggle.checked,
            budgetToggle: budgetToggle.checked,
            equipment: activeEquip,
            preferences: activePrefs
        };
        localStorage.setItem('antiGaspiProfile', JSON.stringify(data));
        
        // Auto-update Generator badges when profile changes
        badges.forEach(badge => {
            if (activePrefs.includes(badge.textContent.trim())) {
                badge.classList.add('active');
            } else {
                badge.classList.remove('active');
            }
        });

        if (data.darkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
    }

    // Bind profile events
    if(usernameInput) usernameInput.addEventListener('input', saveProfileData);
    if(profileDifficulty) profileDifficulty.addEventListener('change', saveProfileData);
    if(darkModeToggle) darkModeToggle.addEventListener('change', saveProfileData);
    if(budgetToggle) budgetToggle.addEventListener('change', saveProfileData);
    
    gridBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            saveProfileData();
        });
    });

    prefBadges.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            saveProfileData();
        });
    });

    if(resetBtn) {
        resetBtn.addEventListener('click', () => {
            if(confirm('Êtes-vous sûr de vouloir réinitialiser toutes vos données (profil, préférences) ?')) {
                localStorage.removeItem('antiGaspiProfile');
                location.reload(); 
            }
        });
    }

    // ---- Avatar Storage Logic ----
    const avatarContainer = document.getElementById('profile-avatar-container');
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarImg = document.getElementById('avatar-img');
    const avatarEmoji = document.getElementById('avatar-emoji');
    const avatarLoading = document.getElementById('avatar-loading');

    if (avatarContainer && avatarUpload) {
        avatarContainer.addEventListener('click', () => avatarUpload.click());

        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            avatarLoading.classList.remove('hidden'); // Afficher le chargement

            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) throw new Error("Vous devez être connecté.");

                const userId = session.user.id;
                const fileExt = file.name.split('.').pop();
                const filePath = `${userId}/avatar.${fileExt}`; 

                // 1. Upload vers le Storage (écrase l'ancienne si elle existe)
                const { error: uploadError } = await supabaseClient.storage
                    .from('avatars')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                // 2. Récupérer l'URL publique
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                // 3. Mettre à jour la table profiles
                const { error: updateError } = await supabaseClient
                    .from('profiles')
                    .update({ avatar_url: publicUrl })
                    .eq('id', userId);

                if (updateError) throw updateError;

                // 4. Mettre à jour l'UI et le LocalStorage
                avatarImg.src = publicUrl + "?t=" + new Date().getTime(); // Anti-cache
                avatarImg.classList.remove('hidden');
                avatarEmoji.classList.add('hidden');

                const localData = JSON.parse(localStorage.getItem('antiGaspiProfile') || '{}');
                localData.avatar_url = publicUrl;
                localStorage.setItem('antiGaspiProfile', JSON.stringify(localData));

                showToast("Profil mis à jour ! 📸");

            } catch (error) {
                showToast("Erreur : " + error.message);
            } finally {
                avatarLoading.classList.add('hidden');
            }
        });
    }

    // ---- Cloud Storage Logic (Supabase) ----
    async function saveRecipeToCloud(recipe) {
        if (!supabaseClient) return;
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { error } = await supabaseClient
            .from('recipes')
            .insert([{ 
                user_id: user.id, 
                title: recipe.title, 
                content: recipe.html,
                created_at: new Date()
            }]);

        if (error) console.error("Error saving to cloud:", error);
    }

    async function loadRecipesFromCloud() {
        if (!supabaseClient) return;
        const { data: recipes, error } = await supabaseClient
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error loading recipes:", error);
            return;
        }

        renderHistoryListFromDB(recipes);
    }

    function renderHistoryListFromDB(recipes) {
        const historyList = document.getElementById('history-list');
        const resultsSection = document.getElementById('results-section');
        
        if (!historyList) return;
        historyList.innerHTML = '';
        
        if (recipes.length === 0) {
            historyList.innerHTML = '<div class="empty-state"><h3>Aucune recette archivée</h3><p>Vos créations apparaîtront ici.</p></div>';
            return;
        }

        // 1. Show latest in "À la une"
        resultsSection.innerHTML = recipes[0].content;
        resultsSection.classList.remove('hidden');

        // 2. Render the rest in the list
        recipes.slice(1, 11).forEach(recipe => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            // Extract some metadata if possible or use generic
            item.innerHTML = `
                <div class="history-info">
                    <span class="history-icon-small">🥘</span>
                    <div class="history-text-wrapper">
                        <span class="history-title">${recipe.title || "Recette sans nom"}</span>
                        <div class="history-meta">
                            <span>${new Date(recipe.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <svg class="history-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            `;
            
            item.addEventListener('click', () => {
                resultsSection.innerHTML = recipe.content;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                switchToView('history');
            });
            
            historyList.appendChild(item);
        });
    }

    // Initialize state
    loadProfileData();
    updateCounter();
    checkSession();
});
