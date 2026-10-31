/**
 * gsap.config.js
 * Central GSAP plugin registration — import this ONCE at the app entry point.
 * Keeps plugin registration out of individual components.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }
