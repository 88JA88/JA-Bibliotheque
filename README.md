# JA-Bibliothèque

Application web installable pour dessiner une bibliothèque et retrouver ses livres.

## Utiliser l’application

Ouvrez `index.html` dans un navigateur. Les données restent sur l’appareil ; utilisez **Exporter** pour enregistrer la configuration courante dans un fichier JSON et **Importer** pour la restaurer sur cet appareil ou un autre.

Le fichier `ma-bibliotheque.json` est un exemple de configuration actuelle et peut être importé.

Sur iPhone et iPad, **Exporter** ouvre la feuille de partage : choisissez **Enregistrer dans Fichiers**, puis `iCloud Drive > Ma Bibliothèque`. Sur Mac, Safari ne propose pas le sélecteur d’enregistrement Web aux PWA : choisissez **Safari > Réglages > Général > Emplacement de téléchargement > Demander pour chaque téléchargement** pour choisir `iCloud Drive > Ma Bibliothèque` à l’export. Si le navigateur n’ouvre pas de sélecteur, déplacez le fichier téléchargé vers ce dossier dans **Fichiers** (ou le Finder sur Mac). L’export nécessite toujours un choix explicite ; l’application n’écrit pas silencieusement dans iCloud Drive.

## Installer l’application

La PWA est nommée **JA-Bibliothèque**. Elle doit être servie par HTTPS (ou ouverte sur `localhost`) :

- sur iPhone/iPad dans Safari : **Partager** puis **Sur l’écran d’accueil** ;
- sur Android dans Chrome : menu ⋮ puis **Installer l’application** ou **Ajouter à l’écran d’accueil**.

Une fois installée et ouverte au moins une fois, elle fonctionne hors ligne.
