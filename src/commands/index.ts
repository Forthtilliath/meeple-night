import type { Command, ComponentHandler } from '../bot/types.js';
import { calendarHandler } from '../components/calendar.js';
import { pollHandler } from '../components/poll.js';
import { rsvpHandler } from '../components/rsvp.js';
import { collection } from './collection.js';
import { gamenight } from './gamenight/index.js';
import { leaderboard } from './leaderboard.js';
import { ping } from './ping.js';
import { play } from './play.js';
import { settings } from './settings.js';
import { vote } from './vote.js';

export const commands: Command[] = [ping, gamenight, collection, vote, play, leaderboard, settings];

export const componentHandlers: ComponentHandler[] = [rsvpHandler, calendarHandler, pollHandler];
