import type { Messages } from './en.js';

const range = (min: number | null, max: number | null, unit: string) => {
  if (min === null) return '?';
  if (max === null) return `${min}+ ${unit}`;
  return min === max ? `${min} ${unit}` : `${min} à ${max} ${unit}`;
};

const plural = (count: number, word: string) => `${word}${count > 1 ? 's' : ''}`;

export const fr: Messages = {
  common: {
    error: 'Une erreur est survenue, réessaie.',
    guildOnly: 'Cette commande ne fonctionne que sur un serveur.',
    noPermission: "Seul l'organisateur ou un gestionnaire du serveur peut faire ça.",
    gameNotFound: 'Jeu introuvable dans la collection.',
    nightNotFound: 'Soirée introuvable.',
    players: (min, max) => range(min, max, 'joueurs'),
    duration: (min, max) => range(min, max, 'min'),
  },
  ping: (ms) => `Pong ! Latence : ${ms} ms.`,
  night: {
    invalidDate: 'Date ou heure invalide. Exemple : `24/10/2026` ou `2026-10-24` et `20h30`.',
    pastDate: 'Cette date est déjà passée.',
    created: (url) => `Soirée créée : ${url}`,
    when: 'Quand',
    where: 'Où',
    organizer: 'Organisateur',
    going: (count, max) => `Présents (${count}${max ? `/${max}` : ''})`,
    waitlist: "Liste d'attente",
    maybe: 'Peut-être',
    declined: 'Absents',
    nobody: '—',
    footer: (id) => `Soirée n°${id}`,
    cancelledTitle: (title) => `${title} (annulée)`,
    cancelled: 'Soirée annulée.',
    noUpcoming: 'Aucune soirée à venir. Crées-en une avec `/soiree creer`.',
    upcomingTitle: 'Prochaines soirées',
    buttonYes: 'Je viens',
    buttonMaybe: 'Peut-être',
    buttonNo: 'Absent',
    closed: "Cette soirée n'est plus ouverte.",
    rsvpSaved: {
      yes: "C'est noté, à bientôt !",
      maybe: 'Noté en « peut-être ».',
      no: 'Noté, ce sera pour la prochaine !',
    },
    waitlisted: "La soirée est complète : tu es sur liste d'attente.",
    reminderDay: (title, when) => `📅 Rappel : **${title}**, c'est demain, ${when}.`,
    reminderHours: (title, when) => `⏰ **${title}** commence ${when} !`,
  },
  collection: {
    invalidFile: 'Joins le fichier `.json` exporté depuis MyLudo.',
    tooLarge: 'Ce fichier est trop volumineux (5 Mo maximum).',
    parseError: 'Ce fichier ne ressemble pas à un export de collection MyLudo.',
    imported: (created, updated, skipped) =>
      `Import terminé : **${created}** nouveaux jeux, **${updated}** mis à jour, ${skipped} extensions/accessoires ignorés.`,
    empty: 'La collection est vide. Importe-la avec `/collection importer`.',
    noMatch: 'Aucun jeu ne correspond à ces filtres.',
    listTitle: (count) => `Collection — ${count} ${count > 1 ? 'jeux' : 'jeu'}`,
    more: (count) => `…et ${count} de plus. Affine avec les filtres.`,
    players: 'Joueurs',
    duration: 'Durée',
    age: 'Âge',
    year: 'Année',
    categories: 'Catégories',
    mechanics: 'Mécanismes',
    rating: 'Note MyLudo',
    plays: 'Parties enregistrées',
  },
  vote: {
    notEnough: 'Pas assez de jeux correspondent à ces filtres (2 minimum).',
    title: 'À quoi on joue ?',
    description: (players) =>
      `Choisis tous les jeux auxquels tu veux bien jouer${players ? ` (filtrés pour ${players} joueurs)` : ''}.`,
    placeholder: 'Choisis les jeux qui te tentent',
    close: 'Clore le vote',
    voteCount: (count) => `${count} ${plural(count, 'vote')}`,
    voters: (count) => `${count} ${plural(count, 'votant')} pour l'instant`,
    saved: "Vote enregistré. Tu peux le modifier jusqu'à la clôture.",
    closedAlready: 'Ce vote est clos.',
    closedTitle: 'Vote clos',
    winner: (titles) => `🏆 On joue à **${titles}** !`,
    noVotes: "Personne n'a voté.",
  },
  play: {
    needTwoPlayers: 'Une partie demande au moins 2 joueurs.',
    duplicatePlayers: 'Le même joueur apparaît deux fois.',
    scoresMismatch: (players) =>
      `Indique exactement ${players} scores séparés par des virgules, dans l'ordre des joueurs.`,
    recorded: (game) => `Partie de **${game}** enregistrée !`,
    ratingLine: (rank, user, rating, delta) =>
      `${rank}. ${user} — ${Math.round(rating)} (${delta >= 0 ? '+' : ''}${Math.round(delta)})`,
  },
  leaderboard: {
    titleOverall: 'Classement Elo — tous les jeux',
    titleGame: (game) => `Classement Elo — ${game}`,
    empty: 'Aucune partie enregistrée. Utilise `/partie enregistrer` après une partie !',
    line: (position, user, rating, plays) =>
      `**${position}.** ${user} — ${Math.round(rating)} (${plays} ${plural(plays, 'partie')})`,
  },
  settings: {
    title: 'Réglages du serveur',
    timezone: 'Fuseau horaire',
    organizerRole: 'Rôle organisateur',
    noRole: 'Aucun : seuls les membres avec *Gérer le serveur*',
    reminders: 'Rappels',
    reminderHours: (early, late) => `${early} h et ${late} h avant la soirée`,
    invalidTimezone: 'Fuseau inconnu. Choisis-en un dans la liste, ex. `Europe/Paris`.',
    invalidReminders: 'Le second rappel doit être plus proche de la soirée que le premier.',
    saved: 'Réglages enregistrés.',
  },
};
