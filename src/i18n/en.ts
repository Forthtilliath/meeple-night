const range = (min: number | null, max: number | null, unit: string) => {
  if (min === null) return '?';
  if (max === null) return `${min}+ ${unit}`;
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
};

export const en = {
  common: {
    error: 'Something went wrong, please try again.',
    guildOnly: 'This command only works in a server.',
    noPermission: 'Only the organizer or a server manager can do that.',
    gameNotFound: 'Game not found in the collection.',
    nightNotFound: 'Game night not found.',
    players: (min: number | null, max: number | null) => range(min, max, 'players'),
    duration: (min: number | null, max: number | null) => range(min, max, 'min'),
  },
  ping: (ms: number) => `Pong! Gateway latency: ${ms} ms.`,
  night: {
    invalidDate: 'Invalid date or time. Use e.g. `2026-10-24` or `24/10/2026` and `20:30`.',
    pastDate: 'This date is in the past.',
    created: (url: string) => `Game night created: ${url}`,
    when: 'When',
    where: 'Where',
    organizer: 'Organizer',
    going: (count: number, max: number | null) => `Going (${count}${max ? `/${max}` : ''})`,
    waitlist: 'Waitlist',
    maybe: 'Maybe',
    declined: "Can't make it",
    nobody: '—',
    footer: (id: number, recurrence: 'weekly' | 'biweekly' | null) =>
      `Game night #${id}${recurrence ? ` · ${recurrence === 'weekly' ? 'every week' : 'every other week'}` : ''}`,
    game: 'Game',
    calendar: 'Calendar',
    calendarFile: 'Open this file to add the night to your calendar.',
    tooMany: (max: number) =>
      `You already organize ${max} upcoming nights. Cancel one, or ask an organizer.`,
    nothingToEdit: 'Nothing to change: fill in at least one option.',
    edited: 'Game night updated.',
    noticeCancelled: (title: string, when: string) => `❌ **${title}** (${when}) is cancelled.`,
    noticeChanged: (title: string, when: string, location: string | null) =>
      `✏️ **${title}** has changed: ${when}${location ? ` · ${location}` : ''}.`,
    noticePromoted: (title: string) => `🎉 A seat opened up for **${title}**: you're in!`,
    cancelledTitle: (title: string) => `${title} (cancelled)`,
    cancelled: 'Game night cancelled.',
    noUpcoming: 'No upcoming game night. Create one with `/gamenight create`.',
    upcomingTitle: 'Upcoming game nights',
    buttonYes: 'Going',
    buttonMaybe: 'Maybe',
    buttonNo: "Can't",
    closed: 'This game night is no longer open.',
    rsvpSaved: {
      yes: "You're in! See you there.",
      maybe: 'Noted as maybe.',
      no: 'Noted, maybe next time!',
    },
    waitlisted: 'The night is full: you are on the waitlist.',
    reminderEarly: (title: string, when: string) => `📅 Reminder: **${title}** is on ${when}.`,
    reminderLate: (title: string, when: string) => `⏰ **${title}** starts ${when}!`,
  },
  collection: {
    invalidFile: 'Please attach the `.json` file exported from MyLudo.',
    tooLarge: 'This file is too large (max 5 MB).',
    parseError: "This file doesn't look like a MyLudo collection export.",
    imported: (created: number, updated: number, skipped: number) =>
      `Import done: **${created}** new games, **${updated}** updated, ${skipped} extensions/accessories skipped.`,
    empty: 'The collection is empty. Import it with `/collection import`.',
    noMatch: 'No game matches these filters.',
    listTitle: (count: number) => `Collection — ${count} game${count > 1 ? 's' : ''}`,
    more: (count: number) => `…and ${count} more. Narrow it down with the filters.`,
    players: 'Players',
    duration: 'Duration',
    age: 'Age',
    year: 'Year',
    categories: 'Categories',
    mechanics: 'Mechanics',
    rating: 'MyLudo rating',
    plays: 'Plays recorded',
  },
  vote: {
    notEnough: 'Not enough games match these filters (at least 2 needed).',
    title: 'Which game shall we play?',
    description: (players: number | null) =>
      `Pick every game you'd be happy to play${players ? ` (filtered for ${players} players)` : ''}.`,
    placeholder: 'Choose the games you like',
    close: 'Close the vote',
    voteCount: (count: number) => `${count} vote${count > 1 ? 's' : ''}`,
    voters: (count: number) => `${count} voter${count > 1 ? 's' : ''} so far`,
    saved: 'Your vote has been saved. You can change it until the vote is closed.',
    closedAlready: 'This vote is closed.',
    closedTitle: 'Vote closed',
    winner: (titles: string) => `🏆 Let's play **${titles}**!`,
    noVotes: 'Nobody voted.',
  },
  play: {
    needTwoPlayers: 'A play needs at least 2 players.',
    duplicatePlayers: 'The same player appears twice.',
    scoresMismatch: (players: number) =>
      `Give exactly ${players} scores separated by commas, in the same order as the players.`,
    recorded: (game: string) => `Play of **${game}** recorded!`,
    ratingLine: (rank: number, user: string, rating: number, delta: number) =>
      `${rank}. ${user} — ${Math.round(rating)} (${delta >= 0 ? '+' : ''}${Math.round(delta)})`,
  },
  leaderboard: {
    titleOverall: 'Elo ranking — all games',
    titleGame: (game: string) => `Elo ranking — ${game}`,
    empty: 'No play recorded yet. Use `/play record` after a game!',
    line: (position: number, user: string, rating: number, plays: number) =>
      `**${position}.** ${user} — ${Math.round(rating)} (${plays} play${plays > 1 ? 's' : ''})`,
  },
  settings: {
    title: 'Server settings',
    timezone: 'Timezone',
    organizerRole: 'Organizer role',
    noRole: 'None: only members with *Manage Server*',
    reminders: 'Reminders',
    reminderHours: (early: number, late: number) => `${early} h and ${late} h before the night`,
    invalidTimezone: 'Unknown timezone. Pick one from the list, e.g. `Europe/Paris`.',
    invalidReminders: 'The second reminder must be closer to the night than the first one.',
    saved: 'Settings saved.',
  },
};

export type Messages = typeof en;
