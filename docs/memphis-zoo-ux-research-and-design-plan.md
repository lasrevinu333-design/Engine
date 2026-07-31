# Memphis Zoo Operations UX Research and Design Plan

**Status:** Research-backed implementation plan
**Scope:** Operations Leadership app, read-only Viewer, browser Hub, and proposed employee custodial app
**Primary objective:** Make operational work feel calm, immediate, trustworthy, physically satisfying, and unmistakably Memphis Zoo without sacrificing speed or clarity.

## 1. Research method

There is no credible universal ranking of “best-designed apps.” Raw App Store and Google Play star ratings are heavily affected by price, content, brand familiarity, outages, and customer support rather than interface quality alone. This plan therefore uses a triangulated evidence set:

1. Apple Design Award winners and finalists from 2024–2026, especially the Interaction, Visuals and Graphics, Delight and Fun, and Inclusivity categories.
2. Google Play Best of 2023–2025 winners, especially apps praised for intuitive design, tactile interaction, visual storytelling, and multi-device continuity.
3. Apple Human Interface Guidelines, Android design and performance guidance, Material Design guidance, and WCAG 2.2.
4. Peer-reviewed research on emotional design, perceived aesthetics, haptics, and touchscreen interaction.
5. Field constraints specific to Memphis Zoo custodial work: one-handed use, outdoor glare, wet or gloved hands, shared/dedicated devices, intermittent connectivity, urgent tasks, and the need to minimize cognitive load.

## 2. What consistently excellent apps have in common

### 2.1 A single, obvious purpose

Top design-award apps are not simply attractive. They make their purpose immediately understandable and remove features that compete with it. Apple’s 2026 design principles emphasize purpose, agency, simplicity, craft, and delight. The 2026 Delight and Fun winner `grug` was praised for having no login, no cloud synchronization, and nothing extraneous. Google Play’s 2025 Best App, Focus Friend, was praised as a simple and effective tool for staying present.

**Memphis Zoo implication:** Every screen should answer one question: “What should I do here?” Each module should have one primary action and no more than two secondary actions visible without opening a menu.

### 2.2 Immediate feedback and perceived direct manipulation

Apple recommends keeping discrete tap response work below roughly 100 ms and continuous interaction work within one display refresh interval. Android recommends rendering within 16 ms for 60 fps. Award-winning apps repeatedly receive praise for controls that feel natural, precise, responsive, and tactile.

**Memphis Zoo implication:**

- A tap changes visual state immediately, even when the server request continues.
- Network operations use optimistic state or a clear progress state.
- No button remains visually unchanged after activation.
- Scrolling, swiping, opening panels, and switching modules must remain smooth on older supported phones.
- A user should never wonder whether a tap registered.

### 2.3 Clear hierarchy and scanability

Moonlitt, Structured, Tide Guide, Mela, iA Writer, Watch Duty, and Vocabulary were praised for simple elegance, easy onboarding, sharply organized information, scan-friendly layouts, and minimizing distraction. Great apps use visual hierarchy rather than adding more labels.

**Memphis Zoo implication:**

- Highest-priority information occupies the top-left/top-leading region.
- Status, location, assigned employee, and next required action are visually dominant.
- Supporting detail is progressively disclosed.
- Dense manager information is summarized first, with drill-down available.
- Employee screens use very large controls and short phrases.

### 2.4 Familiar behavior with a distinct personality

Excellent apps use platform conventions for navigation, controls, gestures, permissions, alerts, and accessibility, while developing a distinctive visual voice. The personality is carried by typography, illustration, motion, color, copy, and a few signature interactions—not by inventing unfamiliar navigation.

**Memphis Zoo implication:**

- Use familiar bottom navigation, lists, cards, switches, sheets, and back behavior.
- Preserve the Memphis Zoo logo and green as the global identity anchor.
- Add zoo personality through artwork, habitat accents, motion, and tone without making controls unpredictable.

### 2.5 Cohesive visual themes tied to content

Tide Guide was praised for tying animations and a sky-responsive palette to its aquatic subject. Vocabulary was praised for consistent illustrations, balanced typography, and varied but coherent themes. Katha Room used culturally relevant art rather than generic decoration. Award-winning apps use a theme because it reinforces meaning.

**Memphis Zoo implication:** Habitat themes are appropriate when they identify context and reinforce location, but they must not change the basic interaction grammar.

Recommended model:

- **Global shell:** Memphis Zoo green, deep navy, white, consistent logo, typography, card shapes, navigation, and status semantics.
- **Habitat accent layer:** a controlled accent palette, illustration, texture, and subtle motion associated with the operational area.
- **Universal status colors:** success, warning, overdue, offline, and error colors never change by habitat.

Possible accent families for design exploration, not final mandates:

- Aquatic areas: midnight blue, deep teal, cool cyan, slow light-caustic movement.
- Forest/primate areas: deep vegetation green, moss, warm shadow, subtle leaf movement.
- Savannah/African Veldt areas: warm khaki, ochre, dusk amber, restrained horizon forms.
- Arctic/penguin areas: ice blue, slate, white, soft snow or bubble particles.
- Nocturnal areas: charcoal, indigo, dim gold, very low-motion glow.

The design team should validate palettes against actual zoo branding, contrast requirements, and location categories before implementation.

### 2.6 Delight that serves the task

Apple explicitly warns not to confuse delight with decoration. Great apps create memorable micro-moments without delaying work. Examples include CapWords’ camera-to-sticker transformation, PowerWash Simulator’s nozzle-specific haptics, Focus Friend’s cute focus character, and Vocabulary’s illustrations and haptics.

**Memphis Zoo implication:** Use delight at meaningful moments:

- Cleaning completed successfully.
- A location returns to current status.
- An offline item synchronizes.
- A manager resolves an overdue condition.
- A new employee completes onboarding.

Do not animate every tap, play animal sounds on every screen, or place moving animals behind text.

### 2.7 Accessibility built in, not bolted on

Speechify, Guitar Wiz, Structured, Art of Fauna, oko, and Sago Mini were recognized for reducing cognitive load and supporting VoiceOver, Dynamic Type, high contrast, reduced motion, alternative controls, and non-color cues. WCAG 2.2 requires minimum target sizing or spacing and clear status messages.

**Memphis Zoo implication:**

- Target WCAG 2.2 AA at minimum.
- Use at least 48–56 dp/pt for primary field controls, exceeding the 24 CSS px WCAG minimum because custodial users may have wet hands, gloves, large fingers, or be moving.
- Never communicate status through color alone.
- Support screen readers, system font scaling, increased contrast, and reduced motion.
- Use visible focus states for desktop browser access.
- Avoid fast flashes, unnecessary parallax, and repetitive motion.

### 2.8 Haptics and sound are semantic, sparse, and optional

Apple and Android both recommend short, consistent, system-defined haptics tied to specific actions. Android’s current guidance says “less is more,” and recommends co-designing visual, audio, and tactile feedback. Research has found that rapid, short tactile feedback can improve typing accuracy and completion time and can increase perceived usability.

**Memphis Zoo implication:**

Use a small semantic vocabulary:

| Event | Haptic | Visual | Optional sound |
|---|---|---|---|
| Ordinary selection | light selection tick | pressed state | none |
| Scan accepted | crisp medium confirmation | location card locks in | short soft click |
| Cleaning completed | success pattern | habitat accent bloom/check | short two-note completion tone |
| Warning/due soon | medium warning | amber banner | none by default |
| Error/rejected scan | error pattern | clear red message with correction | short muted alert |
| Offline queued | light impact | queue badge appears | none |
| Queue synchronized | subtle success | badge resolves | none |

Haptics and sounds must be individually disableable. System silent mode and accessibility settings must be respected. Animal calls should not be routine UI sounds; they would become distracting and ambiguous in a real zoo environment.

### 2.9 Context is preserved across navigation

Top apps avoid making people reorient themselves after every transition. Apple’s design principles emphasize preserving context and making recovery easy.

**Memphis Zoo implication:** The long-term manager and employee apps should become single persistent app shells with routed module views and shared session/state. Copying independent HTML pages into a native container is useful for migration, but it creates inconsistent headers, repeated startup logic, access flashes, and fragile cross-page authentication. The shell should own:

- Authentication and secure credential state.
- Navigation.
- Notification routing.
- Offline status and queue state.
- Global search.
- Theme and accessibility preferences.
- Shared loading, error, empty, and success components.

Existing modules can be migrated one at a time behind the shell rather than rewritten all at once.

## 3. Proposed Memphis Zoo design direction

### Design statement

> **Calm competence in a living place.**

The application should feel like professional operational equipment built specifically for a zoo: reliable, quick, readable outdoors, and quietly alive. It should not look like generic enterprise software wearing animal wallpaper.

### Global visual system

- Memphis Zoo logo remains visible in the Hub and primary module headers, but not repeated on every card.
- Deep navy is the primary structural background.
- Memphis Zoo green is the primary action and brand color.
- White and cool gray provide high-contrast text.
- Habitat accents appear in module headers, progress graphics, empty states, and completion moments.
- Cards use a consistent radius, border, elevation, spacing, and internal hierarchy.
- Icons use one coherent family and stroke weight.
- Photography is reserved for location identity and major empty states; text is never placed on busy photography without a strong scrim.
- Illustrations should use a unified commissioned or generated style, not a mixture of clip art, photographs, emojis, and unrelated icon packs.

### Signature interactions

1. **Habitat arrival:** Opening a location subtly shifts the accent color and header illustration to the habitat. Duration 180–260 ms; no blocking animation.
2. **Scan lock-on:** A successful QR/location scan produces a crisp haptic, a short edge highlight, and immediate display of the location name and assignment.
3. **Cleaning progress:** A restrained progress ring or habitat line fills as required steps are completed. It must represent actual recorded work, not a decorative game score.
4. **Completion moment:** A short, accessible success animation—such as a clean sweep, ripple, leaf unfurl, or light shift—uses the location’s habitat accent. It lasts under 700 ms and can be reduced to a fade.
5. **Offline assurance:** The app states “Saved on this phone” immediately, shows a visible queue count, and changes to “Synced” without requiring the user to revisit the screen.
6. **Manager attention sweep:** Overdue and due-soon locations appear in a priority stack with swipe actions for acknowledge, assign, or open. Swipe actions always have visible button equivalents.

## 4. Information architecture

### Operations Leadership app

Recommended persistent navigation:

1. **Today** — dashboard, active issues, events, attendance, attention queue.
2. **Messages** — one production Messenger client after ChatScope evaluation.
3. **Schedule** — staffing, assignments, absences, coverage.
4. **Locations** — status, due soon, overdue, active sessions, location detail.
5. **More** — Events Input, Moxie, Notifications, Manager Access, Device Security, Feedback, diagnostics.

The current Hub can remain as an optional “all modules” launcher on desktop. On phones, a bottom navigation model will reduce repeated Hub returns and make modules feel like one product.

### Read-only Viewer

Recommended navigation:

1. Dashboard
2. Events
3. Feedback

The Viewer should retain normal personal-device conventions and should not expose manager actions, employee details, device credentials, or internal notes.

### Proposed employee custodial app

Recommended navigation:

1. **Today** — assigned employee, shift, current assignment, next location.
2. **Scan & Clean** — camera/QR scan, location state, start/finish workflow.
3. **Messages** — employee and Memphis conversations if enabled.
4. **Schedule** — read-only daily assignment and coverage changes.
5. **Report** — maintenance issue, supply issue, guest cleanliness report, program feedback.

The employee app should launch directly to Today or Scan & Clean based on the device’s assigned role. It should never expose the manager Hub.

## 5. Should employee kiosk phones become apps?

**Recommendation: Yes. Build a separate employee custodial app from the same Capacitor codebase.**

It matters more for employee phones than for casual Viewer users because the employee devices are dedicated operational tools.

### Benefits over the current browser-based kiosk

- Secure device identity and credentials stored outside ordinary browser storage.
- Reliable session restoration without exposing enrollment pages.
- Native camera/QR integration and better control of focus, torch, and scanning.
- Better GPS, network, vibration, status-bar, and background/resume behavior.
- Offline queue persistence and synchronization that survives browser restarts.
- Consistent full-screen layout and keyboard behavior.
- Push or local operational alerts when explicitly needed.
- Easier device health/version reporting.
- App updates can be tested, versioned, and eventually managed centrally.
- Dedicated Android devices can use Android Enterprise lock task mode when the organization is ready, without relying on a third-party kiosk browser.

### What does not require a separate rewrite

Capacitor allows the existing web application code to run in a native shell and access native APIs. The recommended approach is a third build edition in the existing mobile project:

```text
org.memphiszoo.ops          Operations Leadership
org.memphiszoo.viewer       Public/read-only Viewer
org.memphiszoo.custodial    Employee custodial app
```

Shared components, API clients, branding, and offline queue code remain common. Role-specific navigation and permissions differ.

### Dedicated-device management

A native app does not automatically make a phone a locked kiosk. For fully managed zoo-owned Android devices, Android Enterprise supports lock task mode and managed dedicated-device deployment. That can be added later through an EMM/MDM or Android Management API. For temporary testing, screen pinning can be used. Manager personal phones should never use lock task mode.

## 6. Implementation roadmap

### Phase 0 — Reliability baseline

**Goal:** No access flashes, no cross-module session loss, no unexplained `Failed to fetch`, and no ChatScope reload loops.

- Maintain one secure credential source.
- Maintain one bearer-session refresh path.
- Standardize native API requests and retries.
- Add offline/network banners with actionable language.
- Add release/build identifiers to every native About screen.
- Add automated device tests for returning from each module to the Hub.
- Track ChatScope errors, long-poll reconnects, and outbox retries.

**Exit criteria:** 100 consecutive module opens/returns on Android without enrollment flash or lost session; Messenger and ChatScope complete send/read/reconnect tests on two phones and desktop.

### Phase 1 — Design tokens and shared components

**Goal:** One visual and interaction grammar.

Create shared tokens for:

- Color roles and habitat accent families.
- Typography scale.
- Spacing and grid.
- Corner radius and elevation.
- Touch target sizes.
- Motion durations and easing.
- Haptic semantics.
- Sound semantics.
- Error, warning, success, offline, and loading states.

Create shared components:

- App shell and bottom navigation.
- Module header.
- Primary/secondary/destructive buttons.
- Status chip and attention banner.
- Location card.
- Employee/manager identity card.
- Loading skeleton.
- Empty state.
- Offline queue indicator.
- Confirmation sheet.
- Accessible toast/status message.

### Phase 2 — Manager shell migration

**Goal:** Replace page-to-page launcher behavior with a coherent mobile app.

Migration order:

1. Today dashboard.
2. Messages.
3. Schedule.
4. Locations.
5. Events and Events Input.
6. Notifications.
7. Manager Access and Device Security.
8. Moxie and diagnostics.

Keep desktop browser modules operational throughout migration.

### Phase 3 — Employee custodial app

**Goal:** A purpose-built field workflow.

- Add `custodial` Capacitor edition and package ID.
- Enroll by employee/device credential.
- Implement Today and Scan & Clean first.
- Move the existing IndexedDB/offline scan queue into the shared app layer.
- Add native camera scanner, torch, GPS, and network state.
- Add optional employee Messenger.
- Add app version/health reporting.
- Pilot on two employee phones before wider rollout.

### Phase 4 — Habitat identity and sensory polish

**Goal:** Add controlled zoo-specific delight after core usability is stable.

- Produce 4–6 habitat accent prototypes.
- Test legibility outdoors and in low light.
- Choose one illustration style.
- Add completion animations, haptics, and optional sound.
- Add a Reduce Motion mode and haptic/sound toggles.
- Compress all graphics and preload only the current habitat assets.

### Phase 5 — Field testing and measurement

Test with managers and custodial employees in actual conditions:

- One-handed use.
- Wet hands and gloves.
- Bright sunlight.
- Weak Wi-Fi and offline mode.
- Older Android phones.
- Interruptions from calls, notifications, and app switching.
- Shift change and shared-device handoff.

Measure:

- Task success rate.
- Median time to scan/start/finish.
- Wrong-location and duplicate-submit rate.
- Time to recover from an error.
- Offline queue success rate.
- Crash-free and ANR-free sessions.
- Frame jank and launch time.
- System Usability Scale (SUS).
- UEQ-S pragmatic and hedonic quality.
- Qualitative “confidence,” “calm,” and “professional” ratings.

Suggested release targets:

- Tap feedback visible in under 100 ms.
- 60 fps on supported Android devices for common transitions and scrolling.
- No frame over 700 ms.
- 98% or greater first-attempt task success for common workflows.
- 99.9% eventual offline-queue delivery after connectivity returns.
- SUS score of at least 85 before broad deployment.
- No critical task dependent on color, sound, animation, or haptics alone.

## 7. Decisions to avoid

- Do not make every habitat a completely different app skin.
- Do not use animal imagery as buttons unless the meaning is universally clear and labeled.
- Do not use background photographs behind dense operational data.
- Do not add long animations before urgent information appears.
- Do not add leaderboards or gamification that can shame employees or distort cleaning records.
- Do not use animal calls as routine tap sounds.
- Do not hide errors behind generic messages such as `Failed to fetch`.
- Do not force a manager back through enrollment during a transient network failure.
- Do not maintain two production Messenger interfaces indefinitely; evaluate and select one.

## 8. Immediate next implementation batch

1. Distribute and field-test the current manager build that hides the status bar, removes the Hub enrollment flash, and stabilizes ChatScope.
2. Instrument ChatScope request, reconnect, and outbox errors with a safe client diagnostic record.
3. Create the shared design-token package and a prototype Today shell.
4. Produce three evidence-based habitat accent prototypes: aquatic, forest, and savannah.
5. Build a nonfunctional employee app shell using the proposed five-tab information architecture.
6. Conduct a 30-minute structured test with one manager and two custodial employees before converting additional modules.

## 9. Research sources

### Platform awards and design examples

- Apple Design Awards 2026: https://developer.apple.com/design/awards/
- Apple Design Awards 2025: https://developer.apple.com/design/awards/2025/
- Apple Design Awards 2024: https://developer.apple.com/design/awards/2024/
- Google Play Best of 2025: https://blog.google/products-and-platforms/platforms/google-play/best-apps-games-2025/
- Google Play Best of 2024: https://blog.google/products-and-platforms/platforms/google-play/google-play-best-apps-games-2024/
- Google Play Best of 2023: https://blog.google/products-and-platforms/platforms/google-play/google-play-best-apps-games-2023/

### Platform guidance

- Apple Human Interface Guidelines — Design principles: https://developer.apple.com/design/human-interface-guidelines/design-principles
- Apple HIG — Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility/
- Apple HIG — Playing haptics: https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- Apple — Improving app responsiveness: https://developer.apple.com/documentation/xcode/improving-app-responsiveness
- Android — Haptics design principles: https://developer.android.com/develop/ui/views/haptics/haptics-principles
- Android — Slow rendering: https://developer.android.com/topic/performance/vitals/render
- Android — Immersive content: https://developer.android.com/design/ui/mobile/guides/layout-and-content/immersive-content
- Android — Adaptive layouts: https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout
- Android Enterprise — Dedicated devices: https://developer.android.com/work/dpc/dedicated-devices
- Capacitor documentation: https://capacitorjs.com/docs
- WCAG 2.2 — Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

### Research

- Keqiu, Q., Muhammad, M. S. B., & Norowi, N. B. M. (2026). Emotional Design Elements in Mobile Apps: A TTED-Based Systematic Review. IEEE Access, 14, 12316–12336. https://doi.org/10.1109/access.2026.3656285
- von Wangenheim, C. G., Porto, J. V. A., Hauck, J. C. R., & Borgatto, A. F. (2018). Do we agree on user interface aesthetics of Android apps? https://arxiv.org/abs/1812.09049
- Shin, S. H. et al. (2014). Effect of Tactile Feedback for Button GUI on Mobile Touch Devices. ETRI Journal. https://doi.org/10.4218/etrij.14.0114.0028
- Terenti, M., & Vatavu, R.-D. (2025). Distal-Haptic Touchscreens: Understanding the User Experience of Vibrotactile Feedback Decoupled from the Touch Point. CHI 2025. https://doi.org/10.1145/3706598.3713555
