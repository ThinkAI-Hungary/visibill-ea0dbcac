#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. Token feloldása több lehetséges helyről
function getAccessToken() {
  if (process.env.ASANA_ACCESS_TOKEN) {
    return process.env.ASANA_ACCESS_TOKEN.trim();
  }

  const candidatePaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '.agents/skills/visibill-pm-task-creator/.env'),
    path.resolve(os.homedir(), '.gemini/config/skills/visibill-pm-task-creator/.env'),
    path.resolve(process.cwd(), 'tasks/.asana.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const match = content.match(/ASANA_ACCESS_TOKEN\s*=\s*(.+)/);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  console.error('❌ Hiba: Nem található ASANA_ACCESS_TOKEN!');
  console.error('Kérlek állítsd be a .agents/skills/visibill-pm-task-creator/.env fájlban:');
  console.error('ASANA_ACCESS_TOKEN=2/...');
  process.exit(1);
}

const token = getAccessToken();

async function asanaFetch(endpoint, options = {}) {
  const url = `https://app.asana.com/api/1.0${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Asana API Hiba (${res.status}): ${JSON.stringify(body.errors || body)}`);
  }
  return body.data;
}

async function getWorkspace() {
  const me = await asanaFetch('/users/me');
  if (!me.workspaces || me.workspaces.length === 0) {
    throw new Error('A felhasználónak nincs elérhető Asana munkaterülete.');
  }
  return me.workspaces[0];
}

async function listProjects(workspaceGid) {
  return await asanaFetch(`/workspaces/${workspaceGid}/projects?archived=false&limit=100`);
}

async function listUsers(workspaceGid) {
  return await asanaFetch(`/workspaces/${workspaceGid}/users?opt_fields=name,email`);
}

async function listSections(projectGid) {
  return await asanaFetch(`/projects/${projectGid}/sections`);
}

async function moveTaskToSection(sectionGid, taskGid) {
  return await asanaFetch(`/sections/${sectionGid}/addTask`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        task: taskGid
      }
    })
  });
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeText(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function resolveProject(workspaceGid, projectNameOrGid) {
  const allProjects = await listProjects(workspaceGid);
  if (!projectNameOrGid) {
    return allProjects.find(p => p.name.toLowerCase().includes('visibill dev')) ||
           allProjects.find(p => p.name.toLowerCase().includes('sandbox')) || 
           allProjects[0];
  }

  let target = allProjects.find(p => p.gid === projectNameOrGid);
  if (target) return target;

  const raw = normalizeText(projectNameOrGid);
  target = allProjects.find(p => normalizeText(p.name).includes(raw) || raw.includes(normalizeText(p.name)));
  if (target) return target;

  // Fuzzy match ha 1-2 karakter eltér
  let best = null;
  let highestScore = 0;
  for (const p of allProjects) {
    const pNorm = normalizeText(p.name);
    const dist = levenshtein(raw, pNorm);
    const maxLen = Math.max(raw.length, pNorm.length);
    const sim = (maxLen - dist) / maxLen;
    if (sim > highestScore) {
      highestScore = sim;
      best = p;
    }
  }

  if (best && highestScore >= 0.65) return best;

  return allProjects.find(p => p.name.toLowerCase().includes('visibill dev')) ||
         allProjects.find(p => p.name.toLowerCase().includes('sandbox')) || 
         allProjects[0];
}

function resolveSection(sections, query) {
  if (!query || !sections || sections.length === 0) return null;
  const raw = normalizeText(query);

  // 1. Direct GID or exact name
  const directGid = sections.find(s => s.gid === query.trim());
  if (directGid) return directGid;

  const exact = sections.find(s => normalizeText(s.name) === raw);
  if (exact) return exact;

  const queryTokens = raw.split(/[\s._@-]+/).filter(t => t.length >= 2);
  if (queryTokens.length === 0) return null;

  // Score each section based on token coverage and full string similarity
  const scored = sections.map(s => {
    const secNorm = normalizeText(s.name);
    const secTokens = secNorm.split(/[\s._@-]+/).filter(t => t.length >= 2);

    // Full similarity
    const fullDist = levenshtein(raw, secNorm);
    const maxFullLen = Math.max(raw.length, secNorm.length);
    const fullSim = (maxFullLen - fullDist) / maxFullLen;

    let matchedChars = 0;
    let queryMatchedTokens = 0;

    for (const qt of queryTokens) {
      let bestTokSim = 0;
      let bestTokLen = 0;

      for (const st of secTokens) {
        if (qt === st) {
          bestTokSim = 1.0;
          bestTokLen = qt.length;
          break;
        }
        if (st.startsWith(qt) && qt.length >= 3) {
          bestTokSim = Math.max(bestTokSim, 0.9);
          bestTokLen = qt.length;
        } else if (qt.startsWith(st) && st.length >= 3) {
          bestTokSim = Math.max(bestTokSim, 0.9);
          bestTokLen = st.length;
        } else {
          const dist = levenshtein(qt, st);
          const maxLen = Math.max(qt.length, st.length);
          // Only allow typos for words with length >= 4
          if (maxLen >= 4 && dist <= (maxLen <= 5 ? 1 : 2)) {
            const sim = (maxLen - dist) / maxLen;
            if (sim > bestTokSim) {
              bestTokSim = sim;
              bestTokLen = maxLen;
            }
          }
        }
      }

      if (bestTokSim >= 0.75) {
        matchedChars += bestTokLen * bestTokSim;
        queryMatchedTokens++;
      }
    }

    const queryCoverage = queryMatchedTokens / queryTokens.length;
    const charCoverage = matchedChars / Math.max(raw.length, 1);
    const compositeScore = Math.max(fullSim, (queryCoverage * 0.6 + charCoverage * 0.4));

    return { section: s, score: compositeScore, queryCoverage, fullSim };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score >= 0.60 && (best.queryCoverage >= 0.5 || best.fullSim >= 0.7)) {
    return best.section;
  }

  return null;
}

const KNOWN_ALIASES = {
  'jani': ['schwarczinger', 'janos', 'notbyalongway'],
  'janos': ['schwarczinger', 'janos', 'notbyalongway'],
  'morfi': ['schwarczinger', 'janos', 'notbyalongway'],
  'vali': ['valentin', 'varga'],
  'valentin': ['valentin', 'varga'],
  'robi': ['robert', 'simon', 'simonrobertistvan'],
  'robert': ['robert', 'simon', 'simonrobertistvan'],
  'simi': ['robert', 'simon', 'simonrobertistvan'],
  'dani': ['daniel', 'nagy', 'nagyd965'],
  'daniel': ['daniel', 'nagy', 'nagyd965'],
  'boti': ['botond', 'bartha'],
  'botond': ['botond', 'bartha'],
  'viktor': ['viktor', 'benke'],
  'balazs': ['balazs', 'lederer'],
  'zombi': ['zombi', 'zombori', 'mark', 'zombori.mark'],
  'mark': ['zombi', 'zombori', 'mark', 'zombori.mark'],
  'zombori': ['zombi', 'zombori', 'mark', 'zombori.mark'],
  'ati': ['fekecs', 'attila', 'fekecsati'],
  'attila': ['fekecs', 'attila', 'fekecsati'],
  'fekecs': ['fekecs', 'attila', 'fekecsati']
};

function cleanHungarianWord(w) {
  let s = normalizeText(w);
  s = s.replace(/(nak|nek|ra|re|hoz|hez|hoz|val|vel|t|tol|tol|rol|rol|ba|be|ban|ben)$/i, '');
  s = s.replace(/(cska|cske|ka|ke)$/i, '');
  return s;
}

function resolveAssignee(allUsers, query) {
  if (!query || !allUsers || allUsers.length === 0) return null;

  // 1. Direct GID match
  const directGid = allUsers.find(u => u.gid === query.trim());
  if (directGid) return directGid;

  // 2. Tokenize query with Hungarian suffix cleaning
  const rawTokens = query.split(/[\s._@-]+/).map(cleanHungarianWord).filter(t => t.length >= 2);
  if (rawTokens.length === 0) return null;

  // Pre-tokenize users
  const candidates = allUsers.map(u => {
    const nameNorm = normalizeText(u.name);
    const emailNorm = normalizeText(u.email);
    const tokens = [
      ...nameNorm.split(/[\s._@-]+/),
      ...emailNorm.split(/[\s._@-]+/)
    ].filter(t => t.length >= 2);
    return { user: u, nameNorm, emailNorm, tokens, score: 0 };
  });

  // Calculate score for each user
  for (const c of candidates) {
    for (const qt of rawTokens) {
      let bestTokenScore = 0;

      // A) Check exact alias match first (prevents jani matching dani)
      if (KNOWN_ALIASES[qt]) {
        const targets = KNOWN_ALIASES[qt];
        if (targets.some(tgt => c.tokens.some(ut => ut.includes(tgt) || tgt.includes(ut)))) {
          bestTokenScore = Math.max(bestTokenScore, 1.0);
        }
      }

      // B) Check user tokens (exact & prefix)
      for (const ut of c.tokens) {
        if (ut === qt) {
          bestTokenScore = Math.max(bestTokenScore, 1.0);
        } else if (ut.startsWith(qt) && qt.length >= 3) {
          bestTokenScore = Math.max(bestTokenScore, 0.9);
        } else if (ut.includes(qt) && qt.length >= 4) {
          bestTokenScore = Math.max(bestTokenScore, 0.85);
        }
      }

      // C) Fuzzy match on user tokens if no exact match yet
      if (bestTokenScore < 0.8) {
        for (const ut of c.tokens) {
          const dist = levenshtein(qt, ut);
          const maxLen = Math.max(qt.length, ut.length);
          const maxAllowed = maxLen <= 4 ? 1 : 2;
          if (dist <= maxAllowed) {
            const sim = (maxLen - dist) / maxLen;
            bestTokenScore = Math.max(bestTokenScore, sim * 0.9);
          }
        }
      }

      // D) Fuzzy match on known aliases ONLY if qt is not already an existing known alias
      if (bestTokenScore < 0.8 && !KNOWN_ALIASES[qt]) {
        for (const [aliasKey, targets] of Object.entries(KNOWN_ALIASES)) {
          const aliasDist = levenshtein(qt, aliasKey);
          if (aliasDist <= 1 && Math.max(qt.length, aliasKey.length) >= 4) {
            if (targets.some(tgt => c.tokens.some(ut => ut.includes(tgt)))) {
              bestTokenScore = Math.max(bestTokenScore, 0.85);
            }
          }
        }
      }

      if (bestTokenScore >= 0.7) {
        c.score += bestTokenScore;
      }
    }

    // Full name substring bonus
    const fullClean = rawTokens.join(' ');
    if (c.nameNorm.includes(fullClean) || c.emailNorm.includes(fullClean)) {
      c.score += 1.0;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const second = candidates[1];

  // Zero Wrong Assign Guard:
  // Must have a meaningful score, and if there is a second candidate, the gap must be clear
  if (best && best.score >= 0.75) {
    if (second && second.score === best.score && second.score > 0) {
      console.warn(`⚠️ Kétértelmű felelős (több azonos találat a(z) '${query}' kifejezésre). Nem történt automatikus hozzárendelés.`);
      return null;
    }
    return best.user;
  }

  return null;
}

/**
 * Természetes nyelvű vagy formázott határidő feloldása YYYY-MM-DD dátummá.
 * Dinamikus és elgépelés-biztos (fuzzy match 1-2 karakter eltérésre).
 * Támogatja: 'ma', 'holnap', 'holnapután', 'péntek', 'péntekre', 'péntk', 'jövő hétfő',
 * '+3 nap', '3 nap', '3 nap múlva', '1 hét', '2 hét', 'szeptember 25.', 'szept. 28', '09.28.', '2026.09.30' stb.
 */
function resolveDueDate(input) {
  if (!input) return null;
  const str = input.trim();
  const now = new Date();
  const year = now.getFullYear();
  const pad = n => String(n).padStart(2, '0');
  const formatDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // 1. ISO vagy pontozott formátum: YYYY-MM-DD, YYYY.MM.DD, YYYY. MM. DD.
  const isoMatch = str.match(/^(\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})\.?$/);
  if (isoMatch) return isoMatch[1] + '-' + pad(isoMatch[2]) + '-' + pad(isoMatch[3]);

  // 2. Rövid formátum: MM.DD, MM. DD., MM/DD, MM-DD, 9.28., 09.28.
  const shortMatch = str.match(/^(\d{1,2})[-./\s]+(\d{1,2})\.?$/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1], 10);
    const day = parseInt(shortMatch[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return year + '-' + pad(month) + '-' + pad(day);
    }
  }

  const norm = normalizeText(str);

  // 3. Relatív napok
  if (norm === 'ma' || norm === 'mai nap') return formatDate(now);
  if (norm === 'holnap' || norm === 'holnapra' || levenshtein(norm, 'holnap') <= 1) {
    const d = new Date(now); d.setDate(d.getDate() + 1); return formatDate(d);
  }
  if (norm === 'holnaputan' || norm === 'holnaputanra' || levenshtein(norm, 'holnaputan') <= 1) {
    const d = new Date(now); d.setDate(d.getDate() + 2); return formatDate(d);
  }

  // +X nap / X nap múlva / X nap
  const daysMatch = norm.match(/^\+?(\d+)\s*nap/);
  if (daysMatch) {
    const d = new Date(now); d.setDate(d.getDate() + parseInt(daysMatch[1], 10)); return formatDate(d);
  }

  // hét / hetek
  if (norm.match(/^(egy|1)\s*het/)) {
    const d = new Date(now); d.setDate(d.getDate() + 7); return formatDate(d);
  }
  if (norm.match(/^(ket|ketto|2)\s*het/)) {
    const d = new Date(now); d.setDate(d.getDate() + 14); return formatDate(d);
  }

  // Hét napjai magyarul
  const dayNames = {
    'vasarnap': 0, 'hetfo': 1, 'kedd': 2,
    'szerda': 3, 'csutortok': 4, 'pentek': 5, 'szombat': 6
  };

  const isNextWeek = norm.includes('jovo') || norm.includes('kovetkezo');
  let cleanDay = norm
    .replace(/(jovo|kovetkezo)/g, '')
    .replace(/\bhet\b/g, '')
    .replace(/(re|ig|ra|en|on|el|al)$/g, '')
    .trim();

  let matchedDayIndex = dayNames[cleanDay];

  // Fuzzy match hét napjaira elgépelés esetén (pl. 'pentk', 'csutortk', 'szrda')
  if (matchedDayIndex === undefined) {
    let bestDayDist = 99;
    for (const [dName, idx] of Object.entries(dayNames)) {
      const dist = levenshtein(cleanDay, dName);
      const maxAllowed = dName.length <= 4 ? 1 : 2;
      if (dist <= maxAllowed && dist < bestDayDist) {
        bestDayDist = dist;
        matchedDayIndex = idx;
      }
    }
  }

  if (matchedDayIndex !== undefined) {
    const targetDay = matchedDayIndex;
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    // Csak akkor kell még +7 nap a jövő hét miatt, ha a célnap még ezen a héten lenne
    if (isNextWeek && targetDay > currentDay) {
      diff += 7;
    }
    const d = new Date(now); d.setDate(d.getDate() + diff); return formatDate(d);
  }

  // Hónap nevek magyarul
  const months = {
    'januar': 1, 'jan': 1, 'februar': 2, 'feb': 2,
    'marcius': 3, 'mar': 3, 'aprilis': 4, 'apr': 4,
    'majus': 5, 'maj': 5, 'junius': 6, 'jun': 6,
    'julius': 7, 'jul': 7, 'augusztus': 8, 'aug': 8,
    'szeptember': 9, 'szept': 9, 'oktober': 10, 'okt': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12
  };

  // 'szeptember 25.', 'szept. 28', 'szept 28-ra', 'oktober 5-ig'
  const monthMatch = norm.match(/([a-z]+)[.\s]+(\d{1,2})(?:[-.\s]*(?:re|ra|ig|an|en))?\.?$/);
  if (monthMatch) {
    let mKey = monthMatch[1];
    let mNum = months[mKey];

    if (!mNum) {
      // Fuzzy match hónap nevére elgépelés esetén
      let bestDist = 99;
      for (const [name, num] of Object.entries(months)) {
        const dist = levenshtein(mKey, name);
        if (dist <= 2 && dist < bestDist) {
          bestDist = dist;
          mNum = num;
        }
      }
    }

    if (mNum) {
      const day = parseInt(monthMatch[2], 10);
      if (day >= 1 && day <= 31) {
        return year + '-' + pad(mNum) + '-' + pad(day);
      }
    }
  }

  return null;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Átalakítja a Task Brief Markdown szövegét tiszta, gazdagon formázott Asana HTML-re (html_notes).
 * Így az Asanában a címsorok valódi bold fejlécként, a mezők félkövérként,
 * a listák és jelölőnégyzetek pedig rendezetten jelennek meg kódjelek nélkül.
 */
function markdownToAsanaHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const processed = [];

  for (let line of lines) {
    let l = line.trim();

    if (!l) {
      processed.push('');
      continue;
    }

    // Főcím (# [Task] ...) -> félkövér kiemelt sor
    if (/^#\s+/.test(l)) {
      const title = l.replace(/^#\s*/, '').replace(/\*\*/g, '').trim();
      processed.push(`<strong>${escapeXml(title)}</strong>`);
      continue;
    }

    // Alfejezetek (## vagy ### 🎯 Cél és Funkció) -> <h2> fejrész
    if (/^#{2,3}\s+/.test(l)) {
      const headerText = l.replace(/^#{2,3}\s+/, '').replace(/\*\*/g, '').trim();
      processed.push(`<h2>${escapeXml(headerText)}</h2>`);
      continue;
    }

    // Felsorolás félkövér kulccsal: * **Hol:** ... vagy - **Hol:** ...
    const bulletMatch = l.match(/^[\*\-]\s+\*\*([^\*]+)\*\*:?\s*(.*)$/);
    if (bulletMatch) {
      const label = escapeXml(bulletMatch[1].trim().replace(/:$/, ''));
      const rest = escapeXml(bulletMatch[2].trim());
      processed.push(`<strong>${label}:</strong> ${rest}`);
      continue;
    }

    // Sorszámozott lista félkövér kulccsal: 1. **Alapértelmezett sorrend:** ...
    const numMatch = l.match(/^(\d+\.)\s+\*\*([^\*]+)\*\*:?\s*(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const label = escapeXml(numMatch[2].trim().replace(/:$/, ''));
      const rest = escapeXml(numMatch[3].trim());
      processed.push(`${num} <strong>${label}:</strong> ${rest}`);
      continue;
    }

    // Elfogadási kritérium jelölőnégyzet: - [ ] Feltétel
    const boxMatch = l.match(/^[\*\-]\s+(\[[\sx]\])\s*(.*)$/i);
    if (boxMatch) {
      const box = boxMatch[1];
      const rest = escapeXml(boxMatch[2].trim());
      processed.push(`- ${box} ${rest}`);
      continue;
    }

    // Általános szöveg: **kiemelés** -> <strong>kiemelés</strong>
    let lineStr = escapeXml(l);
    lineStr = lineStr.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    lineStr = lineStr.replace(/`([^`]+)`/g, '$1');
    processed.push(lineStr);
  }

  return '<body>' + processed.join('\n') + '</body>';
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const workspace = await getWorkspace();

    if (command === 'list-projects') {
      const projects = await listProjects(workspace.gid);
      console.log(`📁 Asana Projektek (${workspace.name}):`);
      projects.forEach(p => console.log(` - ${p.name} (GID: ${p.gid})`));
      return;
    }

    if (command === 'list-users') {
      const users = await listUsers(workspace.gid);
      console.log(`👥 Asana Tagok (${workspace.name}):`);
      users.forEach(u => console.log(` - ${u.name} <${u.email || 'n/a'}> (GID: ${u.gid})`));
      return;
    }

    if (command === 'list-sections') {
      let projectName = 'Visibill Dev';
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--project' && args[i + 1]) projectName = args[++i];
      }
      const targetProject = await resolveProject(workspace.gid, projectName);
      const sections = await listSections(targetProject.gid);
      console.log(`📑 Szekciók / Kategóriák a(z) '${targetProject.name}' projektben:`);
      sections.forEach(s => console.log(` - ${s.name} (GID: ${s.gid})`));
      return;
    }

    if (command === 'move-task') {
      let taskGid = null;
      let sectionNameOrGid = null;
      let projectName = 'Visibill Dev';

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--task' && args[i + 1]) taskGid = args[++i];
        else if (args[i] === '--section' && args[i + 1]) sectionNameOrGid = args[++i];
        else if (args[i] === '--project' && args[i + 1]) projectName = args[++i];
      }

      if (!taskGid || !sectionNameOrGid) {
        console.error('Használat: node asana.cjs move-task --task <gid> --section <név/gid> [--project <név>]');
        process.exit(1);
      }

      const targetProject = await resolveProject(workspace.gid, projectName);
      const sections = await listSections(targetProject.gid);
      const targetSection = resolveSection(sections, sectionNameOrGid);

      if (!targetSection) {
        console.error(`❌ Szekció nem található: '${sectionNameOrGid}'`);
        process.exit(1);
      }

      await moveTaskToSection(targetSection.gid, taskGid);
      console.log(`✅ Feladat (${taskGid}) sikeresen áthelyezve ide: '${targetSection.name}'`);
      return;
    }

    if (command === 'update-task') {
      let taskGid = null;
      let filePath = null;
      let dueDateInput = null;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--task' && args[i + 1]) taskGid = args[++i];
        else if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
        else if (args[i] === '--due' && args[i + 1]) dueDateInput = args[++i];
      }

      if (!taskGid || (!filePath && !dueDateInput)) {
        console.error('Használat: node asana.cjs update-task --task <gid> [--file <task.md>] [--due <dátum/szöveg>]');
        process.exit(1);
      }

      const updateData = {};

      if (filePath) {
        const fullPath = path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
          console.error(`❌ Fájl nem található: ${fullPath}`);
          process.exit(1);
        }
        const rawMd = fs.readFileSync(fullPath, 'utf8');
        updateData.html_notes = markdownToAsanaHtml(rawMd);
      }

      if (dueDateInput) {
        const resolvedDue = resolveDueDate(dueDateInput);
        if (resolvedDue) {
          updateData.due_on = resolvedDue;
        } else {
          console.log(`⚠️ Nem sikerült feloldani a határidőt: '${dueDateInput}'`);
        }
      }

      const updated = await asanaFetch(`/tasks/${taskGid}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: updateData
        })
      });

      console.log(`✅ Feladat (${updated.gid}) sikeresen frissítve! Határidő: ${updated.due_on || 'Nincs'}`);
      return;
    }

    if (command === 'create-task') {
      // Flag parsing: --file, --project, --section, --assignee, --due
      let filePath = null;
      let projectNameOrGid = 'Visibill Dev';
      let sectionNameOrGid = null;
      let assigneeNameOrEmail = null;
      let dueDateInput = null;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
        else if (args[i] === '--project' && args[i + 1]) projectNameOrGid = args[++i];
        else if (args[i] === '--section' && args[i + 1]) sectionNameOrGid = args[++i];
        else if (args[i] === '--assignee' && args[i + 1]) assigneeNameOrEmail = args[++i];
        else if (args[i] === '--due' && args[i + 1]) dueDateInput = args[++i];
      }

      if (!filePath) {
        console.error('Használat: node asana.cjs create-task --file <task.md> [--project <nev/gid>] [--section <nev/gid>] [--assignee <nev/email>] [--due <dátum>]');
        process.exit(1);
      }

      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Fájl nem található: ${fullPath}`);
        process.exit(1);
      }

      const rawMd = fs.readFileSync(fullPath, 'utf8');
      const lines = rawMd.split('\n');

      // Cím kinyerése az első fejlécsorból
      let taskName = path.basename(filePath, '.md');
      for (const l of lines) {
        if (l.startsWith('# ')) {
          taskName = l.replace(/^#\s*🎫?\s*\[?Task\]?:?\s*/i, '').trim();
          break;
        }
      }

      // Rich HTML leírás készítése Asana formátumban
      const htmlNotes = markdownToAsanaHtml(rawMd);

      // 1. Projekt feloldása
      const targetProject = await resolveProject(workspace.gid, projectNameOrGid);

      // 2. Felelős feloldása (ha megadott, becenevek és ragok intelligens kezelésével)
      const allUsers = await listUsers(workspace.gid);
      let assigneeGid = null;
      let resolvedAssigneeName = null;
      if (assigneeNameOrEmail) {
        const found = resolveAssignee(allUsers, assigneeNameOrEmail);
        if (found) {
          assigneeGid = found.gid;
          resolvedAssigneeName = found.name;
        } else {
          console.log(`⚠️ Felelős ('${assigneeNameOrEmail}') nem található az Asana tagok között.`);
        }
      }

      // 2.5 Kötelező kollaborátor: Schwarczinger János
      const janosUser = allUsers.find(u => 
        (u.name && u.name.toLowerCase().includes('schwarczinger')) ||
        (u.email && u.email.toLowerCase().includes('notbyalongway')) ||
        u.gid === '1211076807620877'
      );
      const janosGid = janosUser ? janosUser.gid : '1211076807620877';
      const followers = [janosGid];

      // 2.7 Határidő feloldása
      const resolvedDue = resolveDueDate(dueDateInput);

      // 3. Task létrehozása rich text formátummal
      const payload = {
        data: {
          name: taskName,
          html_notes: htmlNotes,
          projects: [targetProject.gid],
          ...(assigneeGid ? { assignee: assigneeGid } : {}),
          ...(resolvedDue ? { due_on: resolvedDue } : {}),
          followers: followers
        }
      };

      const created = await asanaFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // 4. Ha szekció (kategória) meg van adva, tegyük át oda (elgépelés-biztos fuzzy kereséssel)
      let resolvedSectionName = null;
      if (sectionNameOrGid) {
        const sections = await listSections(targetProject.gid);
        const targetSection = resolveSection(sections, sectionNameOrGid);
        if (targetSection) {
          await moveTaskToSection(targetSection.gid, created.gid);
          resolvedSectionName = targetSection.name;
        } else {
          console.log(`⚠️ Szekció ('${sectionNameOrGid}') nem található a(z) '${targetProject.name}' projektben.`);
        }
      }

      console.log(JSON.stringify({
        success: true,
        gid: created.gid,
        name: created.name,
        project: targetProject.name,
        project_gid: targetProject.gid,
        section: resolvedSectionName || 'Alapértelmezett (első szekció)',
        assignee: resolvedAssigneeName || 'Nincs hozzárendelve',
        due_date: resolvedDue || 'Nincs megadva',
        collaborators: ['Schwarczinger János'],
        url: created.permalink_url || `https://app.asana.com/0/${targetProject.gid}/${created.gid}`
      }, null, 2));
      return;
    }

    console.log('Ismeretlen parancs. Elérhető: list-projects | list-users | list-sections | move-task | update-task | create-task');
  } catch (err) {
    console.error('❌ Hiba:', err.message);
    process.exit(1);
  }
}

main();
