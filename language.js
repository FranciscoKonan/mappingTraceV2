/* ============================================================
   MappingTrace - Global Language Manager
   Supported languages: English (EN) / Français (FR)
   ============================================================ */

(function () {
    'use strict';

    const STORAGE_KEY = 'mappingtrace_language';

    const translations = {

        en: {
            // Global navigation
            'Dashboard': 'Dashboard',
            'Project Statistics': 'Project Statistics',
            'Project Settings': 'Project Settings',
            'Data Management': 'Data Management',
            'Farm Submissions': 'Farm Submissions',
            'Team Management': 'Team Management',
            'Notifications': 'Notifications',
            'Logout': 'Logout',
            'Profile': 'Profile',
            'Settings': 'Settings',

            // Common actions
            'Save': 'Save',
            'Cancel': 'Cancel',
            'Close': 'Close',
            'Delete': 'Delete',
            'Edit': 'Edit',
            'Update': 'Update',
            'Submit': 'Submit',
            'Approve': 'Approve',
            'Reject': 'Reject',
            'Validate': 'Validate',
            'Continue': 'Continue',
            'Back': 'Back',
            'Next': 'Next',
            'Apply': 'Apply',
            'Reset': 'Reset',
            'Search': 'Search',
            'Export': 'Export',
            'Refresh': 'Refresh',
            'View': 'View',
            'Download': 'Download',
            'Copy': 'Copy',

            // Project
            'Project': 'Project',
            'Projects': 'Projects',
            'Project Period': 'Project Period',
            'Project Duration': 'Project Duration',
            'Days Elapsed': 'Days Elapsed',
            'Days Remaining': 'Days Remaining',
            'Timeline': 'Timeline',

            // Statistics
            'Project Statistics': 'Project Statistics',
            'Total Farms': 'Total Farms',
            'Total Area (ha)': 'Total Area (ha)',
            'Active Enumerators': 'Active Enumerators',
            'Avg Daily Submissions': 'Avg Daily Submissions',
            'Mapped Farms': 'Mapped Farms',
            'Farms': 'Farms',
            'Area (ha)': 'Area (ha)',
            'Active Days': 'Active Days',
            'Submission Trend': 'Submission Trend',
            'Mapped Farms by Enumerator': 'Mapped Farms by Enumerator',
            'Area by Cooperative': 'Area by Cooperative',
            'Enumerator Mapping Activity': 'Enumerator Mapping Activity',

            // Workflow
            'Workflow Status': 'Workflow Status',
            'Enumerator Review': 'Enumerator Review',
            'Field Officer Review': 'Field Officer Review',
            'GIS Compliance': 'GIS Compliance',
            'Correction Required': 'Correction Required',
            'Final Validation': 'Final Validation',
            'Validated': 'Validated',
            'Rejected': 'Rejected',

            // Quality
            'Quality & Compliance': 'Quality & Compliance',
            'Quality Assessed': 'Quality Assessed',
            'Quality Passed': 'Quality Passed',
            'Issues Detected': 'Issues Detected',
            'Critical Issues': 'Critical Issues',
            'Geometry Valid': 'Geometry Valid',
            'Quality Pass Rate': 'Quality Pass Rate',

            // Filters
            'Filters': 'Filters',
            'All Enumerators': 'All Enumerators',
            'All Cooperatives': 'All Cooperatives',
            'From': 'From',
            'To': 'To',
            'Enumerator': 'Enumerator',
            'Cooperative': 'Cooperative',

            // Common messages
            'Loading...': 'Loading...',
            'No data available': 'No data available',
            'No results found': 'No results found',
            'Success': 'Success',
            'Error': 'Error',
            'Warning': 'Warning',
            'Please wait...': 'Please wait...',
            'Operation completed successfully.':
                'Operation completed successfully.'
        },

        fr: {
            // Navigation
            'Dashboard': 'Tableau de bord',
            'Project Statistics': 'Statistiques du projet',
            'Project Settings': 'Paramètres du projet',
            'Data Management': 'Gestion des données',
            'Farm Submissions': 'Soumissions des parcelles',
            'Team Management': 'Gestion de l’équipe',
            'Notifications': 'Notifications',
            'Logout': 'Déconnexion',
            'Profile': 'Profil',
            'Settings': 'Paramètres',

            // Actions
            'Save': 'Enregistrer',
            'Cancel': 'Annuler',
            'Close': 'Fermer',
            'Delete': 'Supprimer',
            'Edit': 'Modifier',
            'Update': 'Mettre à jour',
            'Submit': 'Soumettre',
            'Approve': 'Approuver',
            'Reject': 'Rejeter',
            'Validate': 'Valider',
            'Continue': 'Continuer',
            'Back': 'Retour',
            'Next': 'Suivant',
            'Apply': 'Appliquer',
            'Reset': 'Réinitialiser',
            'Search': 'Rechercher',
            'Export': 'Exporter',
            'Refresh': 'Actualiser',
            'View': 'Voir',
            'Download': 'Télécharger',
            'Copy': 'Copier',

            // Project
            'Project': 'Projet',
            'Projects': 'Projets',
            'Project Period': 'Période du projet',
            'Project Duration': 'Durée du projet',
            'Days Elapsed': 'Jours écoulés',
            'Days Remaining': 'Jours restants',
            'Timeline': 'Calendrier',

            // Statistics
            'Project Statistics': 'Statistiques du projet',
            'Total Farms': 'Total des parcelles',
            'Total Area (ha)': 'Superficie totale (ha)',
            'Active Enumerators': 'Agents de collecte actifs',
            'Avg Daily Submissions': 'Soumissions quotidiennes moyennes',
            'Mapped Farms': 'Parcelles cartographiées',
            'Farms': 'Parcelles',
            'Area (ha)': 'Superficie (ha)',
            'Active Days': 'Jours actifs',
            'Submission Trend': 'Évolution des soumissions',
            'Mapped Farms by Enumerator':
                'Parcelles cartographiées par agent',
            'Area by Cooperative':
                'Superficie par coopérative',
            'Enumerator Mapping Activity':
                'Activité de cartographie par agent',

            // Workflow
            'Workflow Status': 'État du processus',
            'Enumerator Review': 'Contrôle par l’agent',
            'Field Officer Review': 'Contrôle par le superviseur terrain',
            'GIS Compliance': 'Contrôle SIG',
            'Correction Required': 'Correction requise',
            'Final Validation': 'Validation finale',
            'Validated': 'Validé',
            'Rejected': 'Rejeté',

            // Quality
            'Quality & Compliance': 'Qualité et conformité',
            'Quality Assessed': 'Qualité évaluée',
            'Quality Passed': 'Qualité conforme',
            'Issues Detected': 'Problèmes détectés',
            'Critical Issues': 'Problèmes critiques',
            'Geometry Valid': 'Géométrie valide',
            'Quality Pass Rate': 'Taux de conformité qualité',

            // Filters
            'Filters': 'Filtres',
            'All Enumerators': 'Tous les agents',
            'All Cooperatives': 'Toutes les coopératives',
            'From': 'Du',
            'To': 'Au',
            'Enumerator': 'Agent',
            'Cooperative': 'Coopérative',

            // Messages
            'Loading...': 'Chargement...',
            'No data available': 'Aucune donnée disponible',
            'No results found': 'Aucun résultat trouvé',
            'Success': 'Succès',
            'Error': 'Erreur',
            'Warning': 'Avertissement',
            'Please wait...': 'Veuillez patienter...',
            'Operation completed successfully.':
                'Opération terminée avec succès.'
        }
    };

    function getLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === 'fr' || saved === 'en') {
            return saved;
        }

        // Browser language detection
        return navigator.language &&
            navigator.language.toLowerCase().startsWith('fr')
            ? 'fr'
            : 'en';
    }

    function translateText(text, language) {
        const dictionary = translations[language] || translations.en;

        if (!text) return text;

        const cleanText = text.trim();

        return dictionary[cleanText] || text;
    }

    function translatePage() {
        const language = getLanguage();

        document.documentElement.lang = language;

        // Translate elements explicitly marked with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');

            if (translations[language]?.[key]) {
                element.textContent = translations[language][key];
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');

            if (translations[language]?.[key]) {
                element.placeholder = translations[language][key];
            }
        });

        updateLanguageSwitcher();
    }

    function setLanguage(language) {
        if (language !== 'en' && language !== 'fr') {
            return;
        }

        localStorage.setItem(STORAGE_KEY, language);

        translatePage();

        // Allow page-specific scripts to react to language changes
        window.dispatchEvent(
            new CustomEvent('mappingtrace:languageChanged', {
                detail: { language }
            })
        );
    }

    function createLanguageSwitcher() {
        if (document.getElementById('mappingtrace-language-switcher')) {
            return;
        }

        const container = document.createElement('div');

        container.id = 'mappingtrace-language-switcher';
        container.className = 'mappingtrace-language-switcher';

        container.innerHTML = `
            <button
                type="button"
                class="language-option"
                data-language="en"
                aria-label="Switch to English">
                EN
            </button>

            <span class="language-separator">|</span>

            <button
                type="button"
                class="language-option"
                data-language="fr"
                aria-label="Passer au français">
                FR
            </button>
        `;

        container.querySelectorAll('.language-option').forEach(button => {
            button.addEventListener('click', () => {
                setLanguage(button.dataset.language);
            });
        });

        // Put the switcher in the global header when available.
        const header =
            document.querySelector('.header-actions') ||
            document.querySelector('.header-right') ||
            document.querySelector('.top-bar') ||
            document.querySelector('header');

        if (header) {
            header.appendChild(container);
        } else {
            document.body.prepend(container);
        }

        updateLanguageSwitcher();
    }

    function updateLanguageSwitcher() {
        const current = getLanguage();

        document
            .querySelectorAll('#mappingtrace-language-switcher .language-option')
            .forEach(button => {
                button.classList.toggle(
                    'active',
                    button.dataset.language === current
                );
            });
    }

    // Public API
    window.MappingTraceLanguage = {
        getLanguage,
        setLanguage,
        translatePage,
        translateText,
        translations
    };

    // Initialize after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        createLanguageSwitcher();
        translatePage();
    });

})();
