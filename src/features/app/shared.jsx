export const styleTag = `
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    font-size: 16px;
    scrollbar-gutter: stable;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    min-width: 0;
    overflow-x: hidden;
  }

  img, svg, canvas, video {
    max-width: 100%;
  }

  .fixed.inset-0 {
    padding: clamp(0.5rem, 1.4vmin, 1rem) !important;
  }

  .fixed.inset-0[class*="backdrop-blur"] {
    background-color: rgba(0, 0, 0, 0.72) !important;
    backdrop-filter: blur(10px);
  }

  .fixed.inset-0 > form:not([class*="max-w-"]),
  .fixed.inset-0 > div:not([class*="max-w-"]) {
    max-width: calc(100vw - 1rem);
  }

  .fixed.inset-0 > [class*="max-h"],
  .fixed.inset-0 > form,
  .fixed.inset-0 > div {
    max-height: calc(100dvh - 1rem) !important;
  }

  .fixed.inset-0 > [class*="rounded-[3.5rem]"],
  .fixed.inset-0 > [class*="rounded-[3rem]"],
  .fixed.inset-0 > [class*="rounded-[2.5rem]"] {
    border-radius: clamp(1.25rem, 3vmin, 2.25rem) !important;
  }

  @keyframes wiggle {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    25% { transform: translateX(-1px) rotate(-0.5deg); }
    75% { transform: translateX(1px) rotate(0.5deg); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
    50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.6); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
    50% { transform: translateY(-20px) scale(1.1); opacity: 0.6; }
  }
  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes aurora {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes pulse-gold {
    0%, 100% { filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.3)); }
    50% { filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.7)); }
  }
  @keyframes spin-very-slow {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  .animate-glow { animation: glow 3s ease-in-out infinite; }
  .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-rotate-slow { animation: rotate-slow 20s linear infinite; }
  .animate-pulse-gold { animation: pulse-gold 2s ease-in-out infinite; }
  .animate-spin-very-slow { animation: spin-very-slow 60s linear infinite; }

  input::-webkit-calendar-picker-indicator {
    filter: invert(63%) sepia(16%) saturate(832%) hue-rotate(294deg) brightness(92%) contrast(90%);
    cursor: pointer;
  }

  .inner-scrollbar::-webkit-scrollbar { width: 4px; }
  .inner-scrollbar::-webkit-scrollbar-thumb { background: #c96f8d; border-radius: 10px; }

  .neon-border-indigo { border: 1px solid rgba(226, 167, 185, 0.48); box-shadow: 0 0 15px rgba(201, 111, 141, 0.12); }
  .neon-border-emerald { border: 1px solid rgba(168, 201, 183, 0.5); box-shadow: 0 0 15px rgba(127, 169, 149, 0.12); }
  .neon-border-amber { border: 1px solid rgba(229, 201, 131, 0.5); box-shadow: 0 0 15px rgba(216, 182, 109, 0.12); }
  .gold-gradient { background: linear-gradient(135deg, #d8b66d 0%, #b98b41 100%); }

  .bg-mesh-amber {
    background-color: #1a1317;
    background-image:
      radial-gradient(at 0% 0%, rgba(216, 182, 109, 0.24) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(201, 111, 141, 0.18) 0px, transparent 50%),
      url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='%23d8b66d' stroke-opacity='0.08' stroke-width='1' fill='none'/%3E%3C/svg%3E");
    background-size: 100% 100%, 100% 100%, 60px 60px;
  }

  .aurora-effect {
    background: linear-gradient(270deg, rgba(216, 182, 109, 0.18), rgba(20, 15, 18, 0), rgba(201, 111, 141, 0.16));
    background-size: 200% 200%;
    animation: aurora 8s ease infinite;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #c96f8d;
    border-radius: 10px;
  }

  .mobile-simplify-shell {
    min-height: 100dvh;
    height: 100dvh;
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
  }

  .mobile-safe-bottom {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
  }

  .mobile-main-scroll {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
  }

  .adaptive-popover {
    max-width: min(22rem, calc(100vw - 1rem));
    max-height: calc(100dvh - 6rem);
    overflow: visible;
    transform-origin: top right;
  }

  @media (min-width: 768px) {
    .fixed.inset-0 {
      padding: clamp(1.25rem, 3vmin, 2.5rem) !important;
    }

    .fixed.inset-0 > [class*="h-[92vh]"],
    .fixed.inset-0 > [class*="md:h-[90vh]"],
    .fixed.inset-0 > [class*="max-h-[95vh]"],
    .fixed.inset-0 > [class*="max-h-[92vh]"],
    .fixed.inset-0 > [class*="max-h-[88vh]"] {
      height: auto !important;
      max-height: min(84dvh, 44rem) !important;
    }

    .fixed.inset-0 > [class*="max-w-7xl"],
    .fixed.inset-0 > [class*="max-w-6xl"],
    .fixed.inset-0 > [class*="max-w-[70rem]"] {
      max-width: min(92vw, 68rem) !important;
    }
  }

  @media (max-width: 1440px), (max-height: 850px) {
    html {
      font-size: 15px;
    }
  }

  @media (max-width: 1180px), (max-height: 740px) {
    html {
      font-size: 14px;
    }

    .fixed.inset-0 {
      padding: 0.5rem !important;
    }

    .fixed.inset-0 [class*="p-14"],
    .fixed.inset-0 [class*="md:p-14"],
    .fixed.inset-0 [class*="p-10"],
    .fixed.inset-0 [class*="md:p-10"],
    .fixed.inset-0 [class*="p-8"],
    .fixed.inset-0 [class*="md:p-8"],
    .fixed.inset-0 [class*="p-7"],
    .fixed.inset-0 [class*="p-6"],
    .fixed.inset-0 [class*="md:p-6"] {
      padding: clamp(0.85rem, 2vmin, 1.4rem) !important;
    }

    .fixed.inset-0 [class*="space-y-8"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 1rem !important;
    }

    .fixed.inset-0 [class*="space-y-6"] > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.85rem !important;
    }

    .fixed.inset-0 [class*="gap-8"] {
      gap: 1rem !important;
    }

    .fixed.inset-0 [class*="gap-6"] {
      gap: 0.85rem !important;
    }

    .fixed.inset-0 [class*="text-6xl"] {
      font-size: 2.55rem !important;
      line-height: 1 !important;
    }

    .fixed.inset-0 [class*="text-5xl"] {
      font-size: 2.25rem !important;
      line-height: 1 !important;
    }

    .fixed.inset-0 [class*="text-4xl"] {
      font-size: 1.9rem !important;
      line-height: 1.05 !important;
    }

    .fixed.inset-0 [class*="text-3xl"] {
      font-size: 1.65rem !important;
      line-height: 1.05 !important;
    }

    .fixed.inset-0 [class*="rounded-[3.5rem]"],
    .fixed.inset-0 [class*="rounded-[3rem]"],
    .fixed.inset-0 [class*="rounded-[2.5rem]"],
    .fixed.inset-0 [class*="rounded-[2.4rem]"] {
      border-radius: 1.5rem !important;
    }
  }

  @media (max-height: 660px) {
    html {
      font-size: 13px;
    }

    .fixed.inset-0 {
      align-items: center !important;
      padding: 0.35rem !important;
    }

    .fixed.inset-0 > [class*="max-h"],
    .fixed.inset-0 > form,
    .fixed.inset-0 > div {
      max-height: calc(100dvh - 0.7rem) !important;
    }

    .fixed.inset-0 header,
    .fixed.inset-0 footer {
      padding-top: 0.75rem !important;
      padding-bottom: 0.75rem !important;
    }

    .fixed.inset-0 [class*="min-h-[52px]"],
    .fixed.inset-0 [class*="min-h-[48px]"],
    .fixed.inset-0 [class*="min-h-[44px]"] {
      min-height: 2.6rem !important;
    }

    .adaptive-popover {
      padding: 0.75rem !important;
      gap: 0.6rem !important;
      max-height: calc(100dvh - 4.5rem);
    }

    .adaptive-popover [class*="min-h-[46px]"],
    .adaptive-popover [class*="min-h-[42px]"] {
      min-height: 2.45rem !important;
    }
  }

  @media (max-height: 560px) {
    html {
      font-size: 12px;
    }

    .fixed.inset-0 [class*="p-14"],
    .fixed.inset-0 [class*="md:p-14"],
    .fixed.inset-0 [class*="p-10"],
    .fixed.inset-0 [class*="md:p-10"],
    .fixed.inset-0 [class*="p-8"],
    .fixed.inset-0 [class*="md:p-8"],
    .fixed.inset-0 [class*="p-7"],
    .fixed.inset-0 [class*="p-6"],
    .fixed.inset-0 [class*="md:p-6"] {
      padding: 0.75rem !important;
    }

    .fixed.inset-0 [class*="mb-8"],
    .fixed.inset-0 [class*="mb-6"] {
      margin-bottom: 0.75rem !important;
    }

    .adaptive-popover {
      max-height: calc(100dvh - 3.5rem);
      transform: scale(0.92);
    }
  }

  @media (orientation: landscape) and (max-height: 520px) {
    .mobile-simplify-shell .mobile-sidebar {
      max-width: min(62vw, 17rem);
    }

    .mobile-simplify-shell .mobile-sidebar-brand {
      padding-top: 0.6rem !important;
      padding-bottom: 0.55rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-email {
      display: none !important;
    }

    .mobile-simplify-shell .mobile-sidebar-tenant-panel {
      display: none !important;
    }

    .mobile-simplify-shell .mobile-sidebar-footer {
      padding-top: 0.45rem !important;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.45rem) !important;
    }

    .mobile-simplify-shell .mobile-sidebar-actions {
      display: none !important;
    }

    .mobile-simplify-shell .mobile-sidebar-nav {
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      padding-top: 0.2rem !important;
      padding-bottom: 0.55rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar nav button {
      padding-top: 0.52rem !important;
      padding-bottom: 0.52rem !important;
      font-size: 8px !important;
      letter-spacing: 0.12em !important;
    }

    .mobile-simplify-shell .mobile-main-scroll {
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
    }
  }

  @media (min-width: 1024px) and (max-height: 820px) {
    .mobile-simplify-shell .mobile-sidebar-brand {
      padding-top: 1rem !important;
      padding-bottom: 0.85rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-email {
      margin-top: 0.35rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-nav {
      padding-bottom: 0.75rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-nav > button {
      padding-top: 0.78rem !important;
      padding-bottom: 0.78rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-tenant-panel {
      margin-top: 0.5rem !important;
      padding: 0.5rem 0.6rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-tenant-panel select {
      padding-top: 0.45rem !important;
      padding-bottom: 0.45rem !important;
    }

    .mobile-simplify-shell .mobile-sidebar-footer {
      padding-top: 0.75rem !important;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem) !important;
    }

    .mobile-simplify-shell .mobile-sidebar-actions button {
      padding-top: 0.65rem !important;
      padding-bottom: 0.65rem !important;
      margin-bottom: 0.5rem !important;
    }
  }

  @media (min-width: 1024px) and (max-width: 1440px), (min-width: 1024px) and (max-height: 850px) {
    .mobile-simplify-shell main > header {
      padding: 0.75rem 1.5rem !important;
      gap: 0.75rem !important;
    }

    .mobile-simplify-shell main > header h2 {
      font-size: 1.35rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell main > header button {
      min-height: 2.6rem !important;
    }

    .mobile-simplify-shell .mobile-main-scroll > div {
      padding: 1.25rem !important;
    }

    .mobile-simplify-shell .dashboard-view {
      padding: 1.25rem !important;
      padding-bottom: 3rem !important;
      row-gap: 1rem !important;
    }

    .mobile-simplify-shell .dashboard-view > div,
    .mobile-simplify-shell .dashboard-view .grid {
      gap: 1rem !important;
    }

    .mobile-simplify-shell .dashboard-view h3 {
      font-size: 1.75rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .dashboard-view h4 {
      font-size: 2rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .dashboard-view [class*="p-6"] {
      padding: 1rem !important;
    }

    .mobile-simplify-shell .dashboard-view [class*="md:p-8"] {
      padding: 1.25rem !important;
    }

    .mobile-simplify-shell .dashboard-view [class*="rounded-[3rem]"] {
      border-radius: 2rem !important;
    }

    .mobile-simplify-shell .dashboard-view [class*="rounded-[2.5rem]"] {
      border-radius: 1.65rem !important;
    }

    .mobile-simplify-shell .agenda-view {
      padding: 1rem 1.5rem !important;
      gap: 1rem !important;
    }

    .mobile-simplify-shell .agenda-toolbar {
      padding: 1rem 1.25rem !important;
      border-radius: 1.6rem !important;
      gap: 1rem !important;
    }

    .mobile-simplify-shell .agenda-toolbar button {
      padding: 0.8rem 1rem !important;
      border-radius: 1rem !important;
    }

    .mobile-simplify-shell .agenda-toolbar h3 {
      font-size: 1.8rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .agenda-table-shell {
      border-radius: 2rem !important;
    }

    .mobile-simplify-shell .agenda-table-shell [class*="p-4"] {
      padding: 0.8rem !important;
    }

    .mobile-simplify-shell .agenda-table-shell [class*="xl:p-6"] {
      padding: 0.9rem !important;
    }

    .mobile-simplify-shell .agenda-table-shell [class*="w-11"] {
      width: 2.25rem !important;
      height: 2.25rem !important;
      border-radius: 0.8rem !important;
    }

    .mobile-simplify-shell .agenda-table-shell [class*="text-[11px]"] {
      font-size: 0.62rem !important;
    }

    .mobile-simplify-shell .agenda-table-shell [class*="text-[8px]"] {
      font-size: 0.48rem !important;
    }

    .mobile-simplify-shell .pos-view [class*="md:p-8"],
    .mobile-simplify-shell .pos-view [class*="md:p-6"] {
      padding: 1.25rem !important;
    }

    .mobile-simplify-shell .pos-view [class*="rounded-[2.6rem]"],
    .mobile-simplify-shell .pos-view [class*="rounded-[2.5rem]"] {
      border-radius: 1.75rem !important;
    }

    .mobile-simplify-shell .reports-view {
      padding: 1rem 1.25rem !important;
      padding-bottom: 3rem !important;
      row-gap: 1rem !important;
    }

    .mobile-simplify-shell .reports-view > div,
    .mobile-simplify-shell .reports-view section,
    .mobile-simplify-shell .reports-view .grid {
      gap: 1rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="md:p-12"],
    .mobile-simplify-shell .reports-view [class*="md:p-10"],
    .mobile-simplify-shell .reports-view [class*="p-10"] {
      padding: 1.25rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="p-8"],
    .mobile-simplify-shell .reports-view [class*="p-6"] {
      padding: 1rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="rounded-[3.5rem]"],
    .mobile-simplify-shell .reports-view [class*="rounded-[3rem]"] {
      border-radius: 2rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="rounded-[2.5rem]"] {
      border-radius: 1.5rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="text-6xl"] {
      font-size: 2.5rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .reports-view [class*="text-5xl"] {
      font-size: 2.25rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .reports-view [class*="text-4xl"] {
      font-size: 1.85rem !important;
      line-height: 1 !important;
    }

    .mobile-simplify-shell .reports-view [class*="text-3xl"] {
      font-size: 1.55rem !important;
      line-height: 1.05 !important;
    }

    .mobile-simplify-shell .reports-view [class*="min-h-[570px]"] {
      min-height: 390px !important;
    }

    .mobile-simplify-shell .reports-view [class*="md:min-h-[550px]"] {
      min-height: 380px !important;
    }

    .mobile-simplify-shell .reports-view [class*="h-[270px]"],
    .mobile-simplify-shell .reports-view [class*="h-[280px]"],
    .mobile-simplify-shell .reports-view [class*="md:h-[300px]"],
    .mobile-simplify-shell .reports-view [class*="md:h-[320px]"] {
      height: 240px !important;
    }

    .mobile-simplify-shell .reports-view [class*="w-40"] {
      width: 6rem !important;
      height: 6rem !important;
      border-radius: 1.75rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="mt-12"] {
      margin-top: 1.5rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="mt-16"] {
      margin-top: 1.75rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="pt-10"] {
      padding-top: 1.25rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="px-8"] {
      padding-left: 1rem !important;
      padding-right: 1rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="py-7"] {
      padding-top: 1rem !important;
      padding-bottom: 1rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="mb-10"],
    .mobile-simplify-shell .reports-view [class*="md:mb-12"] {
      margin-bottom: 1.25rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="lg:w-[380px]"] {
      width: min(100%, 320px) !important;
    }

    .mobile-simplify-shell .reports-view [class*="lg:min-w-[190px]"] {
      min-width: 145px !important;
    }

    .mobile-simplify-shell .reports-view [class*="min-w-[220px]"] {
      min-width: 0 !important;
    }

    .mobile-simplify-shell .reports-view [class*="min-h-[52px]"] {
      min-height: 2.7rem !important;
    }

    .mobile-simplify-shell .reports-view [class*="tracking-[0.4em]"],
    .mobile-simplify-shell .reports-view [class*="tracking-[0.2em]"],
    .mobile-simplify-shell .reports-view [class*="tracking-widest"] {
      letter-spacing: 0.08em !important;
    }
  }

  @media (max-width: 1024px) {
    .mobile-simplify-shell {
      font-size: 14px;
    }
    .mobile-simplify-shell .mobile-simplify-subtitle {
      display: none !important;
    }
    .mobile-simplify-shell input,
    .mobile-simplify-shell select,
    .mobile-simplify-shell textarea {
      font-size: 16px !important;
    }
    .mobile-simplify-shell input::placeholder,
    .mobile-simplify-shell textarea::placeholder {
      font-size: 16px !important;
    }
  }

  @media print {
    @page {
      margin: 2mm;
    }

    html,
    body {
      background: white !important;
      color: black !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    body * {
      visibility: hidden !important;
    }

    aside,
    main,
    header,
    .no-print:not(.print-modal),
    .no-print:not(.print-modal) * {
      display: none !important;
    }

    .print-modal.no-print {
      display: flex !important;
      justify-content: center !important;
      align-items: flex-start !important;
      visibility: visible !important;
    }

    .print-modal,
    .print-modal * {
      visibility: visible !important;
    }

    .print-modal {
      position: absolute !important;
      inset: 0 auto auto 0 !important;
      width: 100% !important;
      min-height: 0 !important;
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      color: black !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }

    .print-modal > div {
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    .print-modal .custom-scrollbar,
    .print-modal .overflow-y-auto,
    .print-modal .overflow-x-auto {
      overflow: visible !important;
      max-height: none !important;
    }

    .print-modal .no-print,
    .print-modal .no-print * {
      display: none !important;
      visibility: hidden !important;
    }

    #printable-receipt {
      visibility: visible !important;
      display: block !important;
      position: static !important;
      left: 0 !important;
      top: 0 !important;
      width: 200mm !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      background: white !important;
      color: black !important;
      margin: 0 auto !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    #printable-receipt * {
      visibility: visible !important;
      color: black !important;
    }

    #printable-staff-settlement {
      visibility: visible !important;
      display: block !important;
      position: static !important;
      left: 0 !important;
      top: 0 !important;
      width: 244mm !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      background: white !important;
      color: black !important;
      margin: 0 auto !important;
      padding: 2mm !important;
      box-sizing: border-box !important;
      transform: scale(1.2) !important;
      transform-origin: top center !important;
    }

    #printable-staff-settlement * {
      visibility: visible !important;
      color: black !important;
    }
    #printable-staff-settlement table {
      width: 100% !important;
      min-width: 0 !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    #printable-staff-settlement th:nth-child(1),
    #printable-staff-settlement td:nth-child(1) {
      width: 40% !important;
    }
    #printable-staff-settlement th:nth-child(2),
    #printable-staff-settlement td:nth-child(2) {
      width: 22% !important;
    }
    #printable-staff-settlement th:nth-child(3),
    #printable-staff-settlement td:nth-child(3) {
      width: 8% !important;
    }
    #printable-staff-settlement th:nth-child(4),
    #printable-staff-settlement td:nth-child(4) {
      width: 10% !important;
    }
    #printable-staff-settlement th:nth-child(5),
    #printable-staff-settlement td:nth-child(5) {
      width: 10% !important;
    }
    #printable-staff-settlement th:nth-child(6),
    #printable-staff-settlement td:nth-child(6) {
      width: 10% !important;
    }
    #printable-staff-settlement td:first-child .flex {
      display: block !important;
    }
    #printable-staff-settlement td:first-child .w-11 {
      display: none !important;
    }
    #printable-staff-settlement td:first-child p {
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: clip !important;
      letter-spacing: 0 !important;
      line-height: 1.25 !important;
    }
    #printable-staff-settlement td:first-child p:first-child {
      font-size: 13px !important;
    }
    #printable-staff-settlement td:first-child p:not(:first-child) {
      font-size: 10px !important;
    }
    #printable-staff-settlement thead {
      display: table-header-group !important;
    }
    #printable-staff-settlement tfoot {
      display: table-row-group !important;
    }
    #printable-staff-settlement tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    #printable-staff-settlement .overflow-x-auto {
      overflow: visible !important;
    }
    #printable-staff-settlement .settlement-summary-cards {
      display: none !important;
    }
    #printable-staff-settlement th,
    #printable-staff-settlement td {
      border: 1px solid #cbd5e1 !important;
      padding: 7px !important;
      vertical-align: top !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
    }
    #printable-staff-settlement .signature-cell {
      min-width: 0 !important;
      width: 16% !important;
      height: 58px !important;
    }
  }
`;

export const MOCK_STYLISTS = [
  { id: 1, name: 'Sofía Color', fullName: 'Sofía Valeria Martínez López', cedula: '', avatar: 'SC', color: 'border-rose-500', bg: 'bg-rose-600', shadow: 'shadow-rose-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Quincenal' },
  { id: 2, name: 'Camila Nails', fullName: 'Camila Alejandra García Reyes', cedula: '', avatar: 'CN', color: 'border-amber-500', bg: 'bg-amber-600', shadow: 'shadow-amber-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Mensual' },
  { id: 3, name: 'Valeria Glow', fullName: 'Valeria Fernanda Hernández Ruiz', cedula: '', avatar: 'VG', color: 'border-emerald-500', bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/50', paymentMode: 'porcentaje', commission: 12, paymentFrequency: 'Semanal' },
  { id: 4, name: 'Isabella Studio', fullName: 'Isabella Mariana Torres Silva', cedula: '', avatar: 'IS', color: 'border-fuchsia-500', bg: 'bg-fuchsia-600', shadow: 'shadow-fuchsia-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Mensual' },
  { id: 5, name: 'Lucía Bridal', fullName: 'Lucía Antonella Castillo Vega', cedula: '', avatar: 'LB', color: 'border-violet-500', bg: 'bg-violet-600', shadow: 'shadow-violet-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Quincenal' },
  { id: 6, name: 'Daniela Spa', fullName: 'Daniela Elena Morales Soto', cedula: '', avatar: 'DS', color: 'border-teal-500', bg: 'bg-teal-600', shadow: 'shadow-teal-500/50', paymentMode: 'porcentaje', commission: 15, paymentFrequency: 'Diario' },
];

export const STYLIST_PAYMENT_MODE_OPTIONS = [
  { id: 'salario', label: 'Pago por salario' },
  { id: 'porcentaje', label: 'Porcentaje por servicio' },
  { id: 'mixto', label: 'Pago mixto' },
];

export const stylistHasBasePay = (paymentMode) => ['salario', 'mixto'].includes(paymentMode || 'salario');
export const stylistHasCommissionPay = (paymentMode) => ['porcentaje', 'mixto'].includes(paymentMode || 'salario');

export const getStylistPaymentModeLabel = (paymentMode, commissionRate = 0) => {
  if (paymentMode === 'mixto') return `Mixto · Base + ${Number(commissionRate || 0)}%`;
  if (paymentMode === 'porcentaje') return `Comisión ${Number(commissionRate || 0)}%`;
  return 'Salario fijo';
};

const LEGACY_STYLIST_NAME_BY_ID = {
  1: 'Sofía Color',
  2: 'Camila Nails',
  3: 'Valeria Glow',
  4: 'Isabella Studio',
  5: 'Lucía Bridal',
  6: 'Daniela Spa',
  '3d02d755-7a44-4541-a31e-f71dd64e61a5': 'Sofía Color',
  '7f323064-3103-4ffa-8590-a8796ae8a160': 'Camila Nails',
  '55659cbb-d06b-4b91-9909-cf0a2ae07947': 'Valeria Glow',
  '7e7545df-5e54-4518-9d78-b0ffca124991': 'Isabella Studio',
  '6e3ca6fa-d800-4114-8170-c4134387d1b8': 'Lucía Bridal',
  '699c5f2b-512a-455c-a971-bb7aa2b1ab6b': 'Daniela Spa',
};

export const STYLIST_THEME_PALETTE = [
  { id: 'petal', label: 'Rosa pétalo', color: 'border-rose-500', bg: 'bg-rose-600', shadow: 'shadow-rose-500/50' },
  { id: 'champagne', label: 'Champagne', color: 'border-amber-500', bg: 'bg-amber-600', shadow: 'shadow-amber-500/50' },
  { id: 'sage', label: 'Salvia', color: 'border-emerald-500', bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/50' },
  { id: 'mauve', label: 'Malva', color: 'border-fuchsia-500', bg: 'bg-fuchsia-600', shadow: 'shadow-fuchsia-500/50' },
  { id: 'orchid', label: 'Orquídea suave', color: 'border-violet-500', bg: 'bg-violet-600', shadow: 'shadow-violet-500/50' },
  { id: 'mint', label: 'Menta spa', color: 'border-teal-500', bg: 'bg-teal-600', shadow: 'shadow-teal-500/50' },
  { id: 'blush', label: 'Blush profundo', color: 'border-indigo-500', bg: 'bg-indigo-600', shadow: 'shadow-indigo-500/50' },
  { id: 'olive', label: 'Oliva suave', color: 'border-lime-500', bg: 'bg-lime-600', shadow: 'shadow-lime-500/50' },
  { id: 'copper', label: 'Cobre claro', color: 'border-orange-500', bg: 'bg-orange-600', shadow: 'shadow-orange-500/50' },
  { id: 'pearl', label: 'Perla gris', color: 'border-stone-500', bg: 'bg-stone-600', shadow: 'shadow-stone-500/50' },
];

export const standardizeDate = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
};

export const parseLocalDate = (dateStr) => {
  const normalized = standardizeDate(dateStr);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const getPhoneDigits = (value = '') => `${value ?? ''}`.replace(/\D+/g, '').slice(-8);

export const formatPhoneNumber = (value = '') => {
  const digits = getPhoneDigits(value);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const mergeEntitiesById = (...collections) => {
  const merged = new Map();

  collections.flat().forEach((item) => {
    if (!item) return;
    const key = item.id ?? `${item.clientId || ''}-${item.date || ''}-${item.time || ''}`;
    if (!merged.has(String(key))) {
      merged.set(String(key), item);
    }
  });

  return [...merged.values()];
};

export const getMatchingClientAppointments = (client, appointments = [], clients = []) => {
  const clientId = String(client?.id ?? '');
  const clientPhoneDigits = getPhoneDigits(client?.phone);

  return (appointments || []).filter((appointment) => {
    if (String(appointment?.clientId ?? '') === clientId) return true;

    const linkedClient = (clients || []).find(
      (candidate) => String(candidate?.id ?? '') === String(appointment?.clientId ?? '')
    );
    if (!linkedClient) return false;

    return clientPhoneDigits.length === 8 && getPhoneDigits(linkedClient.phone) === clientPhoneDigits;
  });
};

export const normalizeLegacyStylistIdForDirectory = (stylistId, stylists = []) => {
  if (stylistId === null || stylistId === undefined || stylistId === '') return null;

  const normalizedStylists = Array.isArray(stylists) ? stylists : [];
  const exactMatch = normalizedStylists.find((stylist) => String(stylist.id) === String(stylistId));
  if (exactMatch) return String(exactMatch.id);

  const legacyIndex = Number.parseInt(String(stylistId), 10);
  if (!Number.isNaN(legacyIndex) && legacyIndex > 0 && normalizedStylists[legacyIndex - 1]) {
    return String(normalizedStylists[legacyIndex - 1].id);
  }

  return String(stylistId);
};

export const resolveFavoriteStylistName = (appointments = [], stylists = [], emptyLabel = 'N/A') => {
  if (!appointments.length) return emptyLabel;

  const stylistCounts = {};
  appointments.forEach((appointment) => {
    const sourceStylistId = appointment?.rawStylistId ?? appointment?.stylistId;
    const normalizedStylistId = normalizeLegacyStylistIdForDirectory(sourceStylistId, stylists);
    const legacyIndex = Number.parseInt(String(sourceStylistId ?? ''), 10);
    const resolvedName =
      (stylists || []).find((stylist) => String(stylist.id) === String(normalizedStylistId))?.name
      || appointment?.stylistName
      || LEGACY_STYLIST_NAME_BY_ID[String(sourceStylistId ?? '')]
      || ((!Number.isNaN(legacyIndex) && legacyIndex > 0) ? MOCK_STYLISTS[legacyIndex - 1]?.name : '')
      || '';

    if (!resolvedName) return;
    stylistCounts[resolvedName] = (stylistCounts[resolvedName] || 0) + 1;
  });

  const topStylistName = Object.keys(stylistCounts).reduce((bestName, currentName) => (
    !bestName || stylistCounts[currentName] > stylistCounts[bestName] ? currentName : bestName
  ), null);

  return topStylistName || emptyLabel;
};

export const normalizeFavoriteServiceName = (value = '') => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  const normalizedPromotionSuffix = rawValue
    .replace(/\s*(?:·|-|–|—|\|)\s*(?:promo|promoci[oó]n)\s*:\s*.+$/iu, '')
    .trim();

  if (!normalizedPromotionSuffix) return '';

  const comparableValue = normalizedPromotionSuffix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/^(promo|promocion|descuento)/i.test(comparableValue)) {
    return '';
  }

  return normalizedPromotionSuffix;
  /*

  const withoutPromotionSuffix = rawValue
    .replace(/\s*[·|-]\s*promo\s*:\s*.+$/i, '')
    .replace(/\s*[·|-]\s*promocion\s*:\s*.+$/i, '')
    .trim();

  if (!withoutPromotionSuffix) return '';

  if (/^(promo|promocion|descuento)/i.test(withoutPromotionSuffix)) {
    return '';
  }

  return withoutPromotionSuffix;
  */
};

export const getFavoriteServiceName = (appointments = [], emptyLabel = 'N/A') => {
  if (!appointments.length) return emptyLabel;

  const serviceCounts = {};
  appointments.forEach((appointment) => {
    const serviceName = normalizeFavoriteServiceName(appointment?.service || '');
    if (!serviceName) return;
    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
  });

  const topServiceName = Object.keys(serviceCounts).reduce((bestName, currentName) => (
    !bestName || serviceCounts[currentName] > serviceCounts[bestName] ? currentName : bestName
  ), null);

  return topServiceName || emptyLabel;
};

export const getClientInsights = (
  client,
  appointments = [],
  clients = [],
  stylists = [],
  options = {},
) => {
  const {
    emptyFavoriteStylist = 'N/A',
    emptyFavoriteService = 'N/A',
    historyLimit = 10,
  } = options;

  const clientAppointments = getMatchingClientAppointments(client, appointments, clients);
  const finishedAppointments = clientAppointments.filter((appointment) => appointment.status === 'Finalizada');
  const sortedHistory = [...clientAppointments].sort((a, b) => {
    const aDate = `${standardizeDate(a?.date || '')} ${`${a?.time || '00:00'}`.slice(0, 5)}`;
    const bDate = `${standardizeDate(b?.date || '')} ${`${b?.time || '00:00'}`.slice(0, 5)}`;
    return new Date(bDate) - new Date(aDate);
  });
  const sortedFinishedAppointments = sortedHistory.filter((appointment) => appointment.status === 'Finalizada');
  const hasStoredInsights = (
    client?.completedVisits !== undefined
    || client?.totalSpent !== undefined
    || client?.lastVisitAt
    || client?.favoriteStylistName
    || client?.favoriteServiceName
  );

  return {
    completedVisits: hasStoredInsights ? Number(client?.completedVisits || 0) : finishedAppointments.length,
    totalSpent: hasStoredInsights
      ? Number(client?.totalSpent || 0)
      : finishedAppointments.reduce((sum, appointment) => sum + (Number(appointment?.price) || 0), 0),
    lastVisitAt: hasStoredInsights
      ? client?.lastVisitAt || null
      : (sortedFinishedAppointments[0]?.date || null),
    favoriteStylistId: hasStoredInsights
      ? client?.favoriteStylistId || null
      : normalizeLegacyStylistIdForDirectory(
        sortedFinishedAppointments[0]?.rawStylistId ?? sortedFinishedAppointments[0]?.stylistId ?? null,
        stylists,
      ),
    favoriteStylistName: hasStoredInsights
      ? client?.favoriteStylistName || emptyFavoriteStylist
      : resolveFavoriteStylistName(finishedAppointments, stylists, emptyFavoriteStylist),
    favoriteServiceName: hasStoredInsights
      ? normalizeFavoriteServiceName(client?.favoriteServiceName || '') || emptyFavoriteService
      : getFavoriteServiceName(finishedAppointments, emptyFavoriteService),
    statsUpdatedAt: client?.statsUpdatedAt || null,
    history: sortedHistory.slice(0, historyLimit),
  };
};

export const isValidPhoneNumber = (value = '') => getPhoneDigits(value).length === 8;

export const findClientByPhone = (clients = [], phone = '', excludeId = null) => {
  const digits = getPhoneDigits(phone);
  if (digits.length !== 8) return null;
  return (clients || []).find((client) =>
    getPhoneDigits(client.phone) === digits
    && (excludeId === null || excludeId === undefined || String(client.id) !== String(excludeId))
  ) || null;
};

export const getThemeByIndex = (index) => STYLIST_THEME_PALETTE[index % STYLIST_THEME_PALETTE.length];

export const ensureStylistTheme = (stylist, index) => {
  const theme = stylist.color && stylist.bg
    ? { color: stylist.color, bg: stylist.bg, shadow: stylist.shadow || 'shadow-rose-500/50' }
    : getThemeByIndex(index);

  return {
    ...stylist,
    color: theme.color,
    bg: theme.bg,
    shadow: theme.shadow,
    avatar: stylist.avatar || stylist.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?',
    fullName: stylist.fullName || stylist.name || '',
    cedula: stylist.cedula || '',
    salary: Number(stylist.salary || 0),
    commission: Number(stylist.commission || 0),
    paymentMode: stylist.paymentMode || 'salario',
    paymentFrequency: stylist.paymentFrequency || 'Quincenal',
    level: stylist.level || 'Junior',
    phone: formatPhoneNumber(stylist.phone || ''),
  };
};

export const makeId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

export const PROMOTION_CATEGORY = 'Promocion';

export const CATEGORIES = ['Cabello', 'Tratamientos', 'Facial', 'Uñas', 'Producto', 'Combo', PROMOTION_CATEGORY];

export const CATEGORY_LABELS = {
  Cabello: 'Cabello',
  Tratamientos: 'Tratamientos',
  Facial: 'Facial',
  Uñas: 'Uñas',
  Producto: 'Producto',
  Combo: 'Combo',
  [PROMOTION_CATEGORY]: 'Promociones',
};

export const PROMOTION_APPLIES_TO_OPTIONS = ['General'];

export const PROMOTION_DISCOUNT_TYPES = [
  { id: 'percentage', label: 'Porcentaje' },
  { id: 'fixed', label: 'Monto fijo' },
];

export const clampPromotionDiscountValue = (discountType, rawValue) => {
  const numericValue = Number(rawValue);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  if (discountType === 'percentage') {
    return Math.min(Math.max(safeValue, 0), 100);
  }

  return Math.max(safeValue, 0);
};

export const isPromotionService = (service) => service?.category === PROMOTION_CATEGORY;

export const getChargeableServices = (services = [], appliesTo = null) => {
  const normalizedServices = Array.isArray(services) ? services : [];

  return normalizedServices.filter((service) => {
    if (!service || isPromotionService(service)) return false;
    if (appliesTo === 'Producto') return service.category === 'Producto';
    if (appliesTo === 'Servicio') return service.category !== 'Producto';
    return true;
  });
};

export const getPromotionTargetIds = () => [];

export const getPromotionEligibleItems = (promotion, items = []) => {
  if (!promotion) return [];

  const eligibleCategories = Array.isArray(promotion.eligibleCategories)
    ? promotion.eligibleCategories.filter(Boolean)
    : [];

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item) return false;

    const itemCategory = item.category || '';
    if (itemCategory === PROMOTION_CATEGORY) return false;
    if (eligibleCategories.length > 0 && !eligibleCategories.includes(itemCategory)) return false;
    return true;
  });
};

export const calculatePromotionDiscount = (promotion, items = []) => {
  const eligibleItems = getPromotionEligibleItems(promotion, items);
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)),
    0,
  );

  if (!promotion || eligibleSubtotal <= 0) {
    return { amount: 0, eligibleSubtotal, eligibleItems };
  }

  const discountType = promotion.discountType || 'percentage';
  const discountValue = Number(promotion.discountValue || 0);
  const safeDiscountValue = Number.isFinite(discountValue) ? discountValue : 0;

  const rawAmount = discountType === 'fixed'
    ? Math.min(safeDiscountValue, eligibleSubtotal)
    : eligibleSubtotal * (Math.min(Math.max(safeDiscountValue, 0), 100) / 100);

  const amount = Math.round(rawAmount * 100) / 100;
  return { amount, eligibleSubtotal, eligibleItems };
};

export const getApplicablePromotions = (services = [], items = []) =>
  (Array.isArray(services) ? services : [])
    .filter((service) => isPromotionService(service))
    .filter((promotion) => promotion.isActive !== false)
    .filter((promotion) => getPromotionEligibleItems(promotion, items).length > 0);

export const formatPromotionValue = (promotion) => {
  const discountValue = Number(promotion?.discountValue || 0);
  if ((promotion?.discountType || 'percentage') === 'fixed') {
    return `C$ ${discountValue.toLocaleString('es-NI')}`;
  }
  return `${discountValue}%`;
};

export const DEFAULT_SALON_OPEN_TIME = '08:00';
export const DEFAULT_SALON_CLOSE_TIME = '18:00';

export const HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

export const normalizeBusinessTime = (value, fallback = DEFAULT_SALON_OPEN_TIME) => {
  const match = `${value || ''}`.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Math.min(Math.max(Number(match[1]) || 0, 0), 23);
  const minutes = Number(match[2]) || 0;
  const roundedMinutes = minutes < 15 ? 0 : (minutes < 45 ? 30 : 0);
  const normalizedHours = minutes >= 45 ? Math.min(hours + 1, 23) : hours;
  return `${String(normalizedHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
};

export const formatTime12h = (value, fallback = '--:--') => {
  const normalized = normalizeBusinessTime(value, '');
  if (!normalized) return fallback;
  const [rawHours, rawMinutes] = normalized.split(':').map(Number);
  const period = rawHours >= 12 ? 'p. m.' : 'a. m.';
  const hour12 = rawHours % 12 || 12;
  return `${hour12}:${String(rawMinutes || 0).padStart(2, '0')} ${period}`;
};

export const generateBusinessHours = (openTime = DEFAULT_SALON_OPEN_TIME, closeTime = DEFAULT_SALON_CLOSE_TIME) => {
  const toMinutes = (time) => {
    const [hours, minutes] = normalizeBusinessTime(time).split(':').map(Number);
    return (hours * 60) + minutes;
  };
  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  if (end <= start) return HOURS;

  const slots = [];
  for (let minutes = start; minutes <= end; minutes += 30) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots.length ? slots : HOURS;
};

export const PASSWORD_MIN_LENGTH = 6;
export const LOYALTY_REWARD_VISITS = 10;

export const ROLE_META = {
  super_admin: { label: 'Super Admin', badge: 'bg-rose-500 text-white border-rose-300' },
  admin: { label: 'Administrador', badge: 'bg-amber-500 text-amber-950 border-amber-200' },
  cashier: { label: 'Caja', badge: 'bg-emerald-500 text-emerald-950 border-emerald-200' },
};

export const BUSINESS_PLANS = ['Starter', 'Growth', 'Scale'];

export const getPrimaryRole = (user) => {
  const roles = user?.roles || [];
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('cashier')) return 'cashier';
  return null;
};

export const formatLocalDateYmd = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const getTodayString = () => formatLocalDateYmd(new Date());

export const getCurrentTimeHHmm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export const getStylistNominaData = (stylist, appointments = []) => {
  const finishedApts = (appointments || []).filter(
    (a) => String(a.stylistId) === String(stylist.id) && a.status === 'Finalizada' && !a.isPaid
  );
  const totalComissionSales = finishedApts.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const commissionRate = Number(stylist.commission || 0);
  const comission = stylistHasCommissionPay(stylist.paymentMode) ? totalComissionSales * (commissionRate / 100) : 0;
  const base = stylistHasBasePay(stylist.paymentMode) ? Number(stylist.salary || 0) : 0;

  return {
    base,
    comission,
    total: base + comission,
    pendingServices: finishedApts.length,
    salesTotal: totalComissionSales,
    commissionRate,
    modalityLabel: getStylistPaymentModeLabel(stylist.paymentMode, commissionRate),
  };
};
