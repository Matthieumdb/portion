# Portion

Scanne le code-barres d'un produit et l'app te dit combien de grammes peser pour tenir tes macros du créneau (13h / 17h / 20h).

- Données produit : Open Food Facts
- Scanner : html5-qrcode
- Le journal du jour reste sur ton téléphone (localStorage)

## Musculation (web)

Le dossier `app/` est la version web de l'app iPhone Musculation (v4.5.1), avec les mêmes écrans : séance (récupération, coach, programmes, modèles, séance en cours avec repos, supersets et calculateur de disques), nutrition intégrée (journal du jour, doses à peser, scanner de code-barres et Open Food Facts, courses, recettes, bilan), historique, progrès (poids, mensurations, photos, journal, bilan de la semaine) et réglages. Elle s'installe sur l'écran d'accueil et marche hors ligne.

- Tout est enregistré automatiquement sur l'appareil (IndexedDB), avec un point de restauration par jour sur 30 jours.
- « Exporter mes données » crée un fichier JSON au même format que l'app iPhone (nutrition comprise), à ranger dans Fichiers ou iCloud Drive. Un rappel s'affiche si le dernier export date de plus d'une semaine.
- Les données de Portion déjà dans le navigateur se reprennent depuis Nutrition › Réglages.
- Pas d'équivalent web pour l'Apple Watch, les widgets, Siri et les notifications sur l'écran verrouillé. Les photos de progression restent dans le navigateur, comme sur l'iPhone elles ne sont pas dans le fichier.
