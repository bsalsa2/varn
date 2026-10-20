// Script for the secondary pages (contact, privacy).
import { initNavMenu } from './nav-menu.js';
import { initContactForm } from './contact.js';
import { initMotion } from './motion.js';
import { afterLoad, initGfx } from './gfx.js';
import { initReveal } from './reveal.js';

initMotion();
initReveal();
afterLoad(initGfx);
initNavMenu();
initContactForm();
