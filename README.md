# Portion

Scanne le code-barres d'un produit et l'app te dit combien de grammes peser pour tenir tes macros du créneau (13h / 17h / 20h).

- Données produit : Open Food Facts
- Scanner : html5-qrcode
- Le journal du jour reste sur ton téléphone (localStorage)

## Musculation (web)

Le dossier `app/` contient la version web de Musculation : séances, modèles, minuteur de repos, historique et progrès, installable sur l'écran d'accueil et utilisable hors ligne.

- Tout est enregistré automatiquement sur l'appareil (IndexedDB), avec un point de restauration par jour sur 30 jours.
- « Exporter une sauvegarde » crée un fichier JSON au même format que l'app iPhone, à ranger dans Fichiers ou iCloud Drive. Un rappel s'affiche si la dernière sauvegarde date de plus d'une semaine.
