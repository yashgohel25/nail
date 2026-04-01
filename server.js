const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = __dirname;

// ─── Helpers ────────────────────────────────────────────────────────────────

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function generateCertId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `JNA-${year}-${rand}`;
}

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webp': 'image/webp'
  };
  if (fs.existsSync(filePath)) {
    const headers = { 'Content-Type': mimes[ext] || 'text/plain' };
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ── Static files ──────────────────────────────────────────────────────────
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    if (pathname === '/' || pathname === '/index.html') {
      return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (pathname === '/admin' || pathname === '/admin.html') {
      return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    }
    return serveFile(res, path.join(PUBLIC_DIR, pathname));
  }

  // ── API Routes ────────────────────────────────────────────────────────────
  try {
    const data = readData();

    // ── Auth ──────────────────────────────────────────────────────────────
    if (pathname === '/api/login' && method === 'POST') {
      const body = await parseBody(req);
      if (body.username === data.admin.username && body.password === data.admin.password) {
        return json(res, 200, { success: true, token: 'janki_admin_token_2024' });
      }
      return json(res, 401, { success: false, message: 'Invalid credentials' });
    }

    // ── Site Info ─────────────────────────────────────────────────────────
    if (pathname === '/api/site-info') {
      if (method === 'GET') return json(res, 200, data.siteInfo);
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.siteInfo = { ...data.siteInfo, ...body };
        writeData(data);
        return json(res, 200, { success: true, siteInfo: data.siteInfo });
      }
    }

    // ── Services ──────────────────────────────────────────────────────────
    if (pathname === '/api/services') {
      if (method === 'GET') return json(res, 200, data.services);
      if (method === 'POST') {
        const body = await parseBody(req);
        const svc = { ...body, id: generateId('s') };
        data.services.push(svc);
        writeData(data);
        return json(res, 201, svc);
      }
    }
    const svcMatch = pathname.match(/^\/api\/services\/(.+)$/);
    if (svcMatch) {
      const id = svcMatch[1];
      const idx = data.services.findIndex(s => s.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.services[idx] = { ...data.services[idx], ...body };
        writeData(data);
        return json(res, 200, data.services[idx]);
      }
      if (method === 'DELETE') {
        data.services.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Courses ───────────────────────────────────────────────────────────
    if (pathname === '/api/courses') {
      if (method === 'GET') return json(res, 200, data.courses);
      if (method === 'POST') {
        const body = await parseBody(req);
        const course = { ...body, id: generateId('c') };
        data.courses.push(course);
        writeData(data);
        return json(res, 201, course);
      }
    }
    const courseMatch = pathname.match(/^\/api\/courses\/(.+)$/);
    if (courseMatch) {
      const id = courseMatch[1];
      const idx = data.courses.findIndex(c => c.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.courses[idx] = { ...data.courses[idx], ...body };
        writeData(data);
        return json(res, 200, data.courses[idx]);
      }
      if (method === 'DELETE') {
        data.courses.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Gallery ───────────────────────────────────────────────────────────
    if (pathname === '/api/gallery') {
      if (method === 'GET') return json(res, 200, data.gallery);
      if (method === 'POST') {
        const body = await parseBody(req);
        const item = { ...body, id: generateId('g'), addedDate: new Date().toISOString().split('T')[0] };
        data.gallery.push(item);
        writeData(data);
        return json(res, 201, item);
      }
    }
    const galleryMatch = pathname.match(/^\/api\/gallery\/(.+)$/);
    if (galleryMatch) {
      const id = galleryMatch[1];
      const idx = data.gallery.findIndex(g => g.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.gallery[idx] = { ...data.gallery[idx], ...body };
        writeData(data);
        return json(res, 200, data.gallery[idx]);
      }
      if (method === 'DELETE') {
        data.gallery.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Offers ────────────────────────────────────────────────────────────
    if (pathname === '/api/offers') {
      if (method === 'GET') return json(res, 200, data.offers);
      if (method === 'POST') {
        const body = await parseBody(req);
        const offer = { ...body, id: generateId('o') };
        data.offers.push(offer);
        writeData(data);
        return json(res, 201, offer);
      }
    }
    const offerMatch = pathname.match(/^\/api\/offers\/(.+)$/);
    if (offerMatch) {
      const id = offerMatch[1];
      const idx = data.offers.findIndex(o => o.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.offers[idx] = { ...data.offers[idx], ...body };
        writeData(data);
        return json(res, 200, data.offers[idx]);
      }
      if (method === 'DELETE') {
        data.offers.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Inquiries ─────────────────────────────────────────────────────────
    if (pathname === '/api/inquiries') {
      if (method === 'GET') return json(res, 200, data.inquiries);
      if (method === 'POST') {
        const body = await parseBody(req);
        const inq = {
          ...body,
          id: generateId('inq'),
          date: new Date().toISOString(),
          status: 'new'
        };
        data.inquiries.push(inq);
        writeData(data);
        return json(res, 201, { success: true, inquiry: inq });
      }
    }
    const inqMatch = pathname.match(/^\/api\/inquiries\/(.+)$/);
    if (inqMatch) {
      const id = inqMatch[1];
      const idx = data.inquiries.findIndex(i => i.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.inquiries[idx] = { ...data.inquiries[idx], ...body };
        writeData(data);
        return json(res, 200, data.inquiries[idx]);
      }
      if (method === 'DELETE') {
        data.inquiries.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Students ──────────────────────────────────────────────────────────
    if (pathname === '/api/students') {
      if (method === 'GET') return json(res, 200, data.students);
      if (method === 'POST') {
        const body = await parseBody(req);
        const student = {
          id: generateId('st'),
          enrollDate: new Date().toISOString().split('T')[0],
          status: 'active',
          certId: null,
          ...body
        };
        if (student.status === 'completed' && !student.certId) {
          student.certId = generateCertId();
          student.completionDate = new Date().toISOString().split('T')[0];
          data.certificates.push({
            certId: student.certId,
            studentId: student.id,
            studentName: student.name,
            course: student.course,
            issueDate: student.completionDate,
            valid: true
          });
        }
        data.students.push(student);
        writeData(data);
        return json(res, 201, student);
      }
    }
    const stMatch = pathname.match(/^\/api\/students\/([^\/]+)$/);
    if (stMatch) {
      const id = stMatch[1];
      const idx = data.students.findIndex(s => s.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'GET') return json(res, 200, data.students[idx]);
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.students[idx] = { ...data.students[idx], ...body };
        if (data.students[idx].status === 'completed' && !data.students[idx].certId) {
          const certId = generateCertId();
          data.students[idx].certId = certId;
          data.students[idx].completionDate = new Date().toISOString().split('T')[0];
          data.certificates.push({
            certId,
            studentId: id,
            studentName: data.students[idx].name,
            course: data.students[idx].course,
            issueDate: data.students[idx].completionDate,
            valid: true
          });
        }
        writeData(data);
        return json(res, 200, data.students[idx]);
      }
      if (method === 'DELETE') {
        data.students.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Certificate Issue ─────────────────────────────────────────────────
    if (pathname.match(/^\/api\/students\/(.+)\/issue-certificate$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const idx = data.students.findIndex(s => s.id === id);
      if (idx === -1) return json(res, 404, { message: 'Student not found' });
      if (data.students[idx].certId) {
        return json(res, 400, { message: 'Certificate already issued', certId: data.students[idx].certId });
      }
      const certId = generateCertId();
      data.students[idx].certId = certId;
      data.students[idx].status = 'completed';
      data.students[idx].completionDate = new Date().toISOString().split('T')[0];
      const cert = {
        certId,
        studentId: id,
        studentName: data.students[idx].name,
        course: data.students[idx].course,
        issueDate: new Date().toISOString().split('T')[0],
        valid: true
      };
      data.certificates.push(cert);
      writeData(data);
      return json(res, 200, { success: true, certId, cert });
    }

    // ── Certificate Verify ────────────────────────────────────────────────
    if (pathname === '/api/verify-certificate' && method === 'GET') {
      const certId = parsed.query.id;
      const cert = data.certificates.find(c => c.certId === certId);
      if (!cert) return json(res, 404, { valid: false, message: 'Certificate not found or invalid' });
      return json(res, 200, { valid: true, certificate: cert });
    }

    // ── Bookings ──────────────────────────────────────────────────────────
    if (pathname === '/api/bookings') {
      if (method === 'GET') return json(res, 200, data.bookings);
      if (method === 'POST') {
        const body = await parseBody(req);
        const booking = {
          ...body,
          id: generateId('bk'),
          createdAt: new Date().toISOString(),
          status: 'pending'
        };
        data.bookings.push(booking);
        writeData(data);
        return json(res, 201, { success: true, booking });
      }
    }
    const bkMatch = pathname.match(/^\/api\/bookings\/(.+)$/);
    if (bkMatch) {
      const id = bkMatch[1];
      const idx = data.bookings.findIndex(b => b.id === id);
      if (idx === -1) return json(res, 404, { message: 'Not found' });
      if (method === 'PUT') {
        const body = await parseBody(req);
        data.bookings[idx] = { ...data.bookings[idx], ...body };
        writeData(data);
        return json(res, 200, data.bookings[idx]);
      }
      if (method === 'DELETE') {
        data.bookings.splice(idx, 1);
        writeData(data);
        return json(res, 200, { success: true });
      }
    }

    // ── Stats ─────────────────────────────────────────────────────────────
    if (pathname === '/api/stats' && method === 'GET') {
      return json(res, 200, {
        students: data.students.length,
        activeStudents: data.students.filter(s => s.status === 'active').length,
        completedStudents: data.students.filter(s => s.status === 'completed').length,
        certificates: data.certificates.length,
        inquiries: data.inquiries.length,
        newInquiries: data.inquiries.filter(i => i.status === 'new').length,
        galleryItems: data.gallery.length,
        bookings: data.bookings.length,
        pendingBookings: data.bookings.filter(b => b.status === 'pending').length,
        offers: data.offers.filter(o => o.active).length
      });
    }

    json(res, 404, { message: 'Route not found' });

  } catch (err) {
    console.error(err);
    json(res, 500, { message: 'Server error', error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🌸 Janki Nail Art Server running at http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔑 Login: admin / janki@2024\n`);
});