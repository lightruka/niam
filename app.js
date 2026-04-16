/* ============================================
   Anti-Gaspi Chef — Application Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
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

    // ---- Generate Button (Simulated AI) ----
    generateBtn.addEventListener('click', () => {
        // Form Validation
        const ingredientsInput = document.getElementById('ingredients-input');
        if (!ingredientsInput.value.trim()) {
            ingredientsInput.classList.add('shake-error');
            setTimeout(() => ingredientsInput.classList.remove('shake-error'), 400); // match animation duration
            showToast("Veuillez indiquer ce qu'il vous reste !");
            return; // STOP execution
        }

        // Collect user data
        const ingredients = ingredientsInput.value.trim().split(',').map(i => i.trim()).filter(i => i);
        const pTime = document.getElementById('prep-time').value || "30";
        const dietLabels = Array.from(document.querySelectorAll('#view-generator .badge.active')).map(b => b.textContent.trim());

        // Merge with Profile Data!
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
        
        // Hide previous results if any
        resultsSection.classList.add('hidden');

        // Simulate AI network delay
        setTimeout(() => {
            // Restore button
            generateBtn.classList.remove('loading');
            btnContent.classList.remove('hidden');
            btnLoading.classList.add('hidden');

            // Render output
            renderAIResults(ingredients, meals, pTime, allDiets, difficulty, isBudget, eqp, username);

            // Show results
            resultsSection.classList.remove('hidden');

            // Smooth scroll down
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }, 2200);
    });

    // ---- Dynamic Rendering of AI Response ----
    function renderAIResults(ingredients, numMeals, pTime, diets, difficulty, isBudget, eqp, username) {
        let recipesHtml = '';
        
        for(let i=0; i < numMeals; i++) {
            const mainIng = ingredients[i % ingredients.length];
            const secondaryIng = ingredients[(i+1) % ingredients.length] || 'petits légumes';
            const cals = 300 + Math.floor(Math.random() * 250);
            
            // Adjust time roughly based on prep-time selected
            const baseTime = parseInt(pTime);
            const time = baseTime === 15 ? 15 : (baseTime === 30 ? 25 : baseTime - 5);
            
            // Varied titles based on ingredients
            const titles = [
                `Poêlée créative de ${mainIng} et ${secondaryIng}`,
                `Gratin express aux ${mainIng}`,
                `Salade tiède de ${mainIng} rôti(s)`,
                `Bowl anti-gaspi : ${mainIng} & ${secondaryIng}`
            ];
            const dietStr = diets.length > 0 ? ` (${diets[0]})` : '';
            const diffStr = difficulty === 'expert' ? ' 👨‍🍳' : (difficulty === 'facile' ? ' 🌱' : '');
            let title = (isBudget ? "Éco: " : "") + titles[i % titles.length] + dietStr + diffStr;

            const equipStr = eqp.length > 0 ? `Cuisiné avec : ${eqp.join(', ')}` : "Préparez vos ustensiles.";

            // Check if already favorite
            const favs = JSON.parse(localStorage.getItem('antiGaspiFavorites') || '[]');
            const isFav = favs.some(f => f.id === title.trim());
            const activeClass = isFav ? 'active' : '';

            recipesHtml += `
                <div class="recipe" id="recipe-${i+1}">
                    <div class="recipe-header">
                        <h3 class="recipe-name">${title}</h3>
                        <button class="fav-btn ${activeClass}" id="fav-btn-${i+1}" aria-label="Ajouter aux favoris">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                    </div>
                    <div class="recipe-meta">
                        <span class="meta-tag"><span class="meta-icon">🔥</span> ${cals} kcal</span>
                        <span class="meta-tag"><span class="meta-icon">⏱️</span> ${time} min</span>
                        <span class="meta-tag"><span class="meta-icon">👥</span> 2 pers.</span>
                    </div>
                    <div class="recipe-steps">
                        <h4 class="steps-title">Étapes de préparation</h4>
                        <ol class="steps-list">
                            <li>
                                <span class="step-number">1</span>
                                <span class="step-text">Lavez et préparez vos ${mainIng} et ${secondaryIng}. ${equipStr}</span>
                            </li>
                            <li>
                                <span class="step-number">2</span>
                                <span class="step-text">Faites dorer les ${mainIng} avec un filet d'huile (ou beurre).</span>
                            </li>
                            <li>
                                <span class="step-number">3</span>
                                <span class="step-text">Ajoutez les restes de ${secondaryIng} et assaisonnez bien. Laissez mijoter et servez chaud !</span>
                            </li>
                        </ol>
                    </div>
                </div>
                ${i < numMeals - 1 ? '<hr class="recipe-divider">' : ''}
            `;
        }

        const shoppingItems = ['Huile d\'olive', 'Ail & Oignon', 'Bouillon de légumes', 'Herbes fraîches'];
        const neededItemsCount = Math.max(2, Math.floor(Math.random() * 4) + 1);
        const neededItems = shoppingItems.slice(0, neededItemsCount);
        
        let shoppingHtml = '';
        neededItems.forEach((item, idx) => {
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

        const chefName = username ? `Chef ${username}` : "l'IA Anti-Gaspi";

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
                ${recipesHtml}
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
                    <span class="items-done" id="items-done">0 / ${neededItems.length} achetés</span>
                </div>
            </div>

            <!-- Eco tip -->
            <div class="eco-tip" id="eco-tip">
                <span class="eco-icon">💡</span>
                <p>En utilisant vos restes, vous évitez de gaspiller environ <strong>${(numMeals * 0.4).toFixed(1)} kg</strong> de nourriture cette semaine. Bravo !</p>
            </div>
        `;
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

    // Delegation in Results View
    resultsSection.addEventListener('click', (e) => {
        const favBtn = e.target.closest('.fav-btn');
        if (favBtn) {
            const recipeDiv = favBtn.closest('.recipe');
            if(recipeDiv) toggleFavorite(recipeDiv);
        }
    });

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

    // ---- Bottom Navigation & Views ----
    const views = document.querySelectorAll('.view');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const targetTab = item.getAttribute('data-tab');
            views.forEach(view => {
                if (view.id === `view-${targetTab}`) {
                    view.classList.add('active');
                    view.style.animation = 'none';
                    view.offsetHeight; 
                    view.style.animation = null;
                } else {
                    view.classList.remove('active');
                }
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        if (data.equipment) {
            gridBtns.forEach(btn => {
                if (data.equipment.includes(btn.dataset.equip)) btn.classList.add('active');
            });
        }
        
        if (data.preferences) {
            prefBadges.forEach(btn => {
                if (data.preferences.includes(btn.dataset.diet)) btn.classList.add('active');
            });
        }
    }

    function saveProfileData() {
        const activeEquip = Array.from(document.querySelectorAll('.grid-btn.active')).map(b => b.dataset.equip);
        const activePrefs = Array.from(document.querySelectorAll('#profile-diets .pref-badge.active')).map(b => b.dataset.diet);
        
        const data = {
            username: usernameInput.value.trim(),
            difficulty: profileDifficulty.value,
            darkMode: darkModeToggle.checked,
            budgetToggle: budgetToggle.checked,
            equipment: activeEquip,
            preferences: activePrefs
        };
        localStorage.setItem('antiGaspiProfile', JSON.stringify(data));
        
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

    // Initialize Profile state
    loadProfileData();

    // Initialize counter state
    updateCounter();
});
