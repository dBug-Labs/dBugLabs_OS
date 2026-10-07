'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import QRCode from 'qrcode'
import JSZip from 'jszip'

const FONT_OPTIONS = [
  { label: 'Playfair Display', familyVar: '--font-playfair', fallback: 'serif' },
  { label: 'Great Vibes (Script)', familyVar: '--font-great-vibes', fallback: 'cursive' },
  { label: 'Anton', familyVar: '--font-anton', fallback: 'sans-serif' },
  { label: 'Oswald', familyVar: '--font-oswald', fallback: 'sans-serif' },
  { label: 'Barlow', familyVar: '--font-barlow', fallback: 'sans-serif' },
  { label: 'Georgia', familyVar: null, fallback: 'Georgia, serif' },
  { label: 'Times New Roman', familyVar: null, fallback: '"Times New Roman", serif' },
  { label: 'Arial', familyVar: null, fallback: 'Arial, sans-serif' }
]

export default function CertGenerator() {
  // Step 1: Template
  const [templateFile, setTemplateFile] = useState(null)
  const [templateImg, setTemplateImg] = useState(null)
  const [templateDimensions, setTemplateDimensions] = useState({ w: 0, h: 0 })

  // Step 2: Recipients
  const [recipientMode, setRecipientMode] = useState('csv') // 'csv' or 'single'
  const [recipients, setRecipients] = useState([])
  const [csvErrors, setCsvErrors] = useState([])
  const [singlePerson, setSinglePerson] = useState({ name: '', email: '', code: '' })

  // Step 3: Details
  const [certType, setCertType] = useState('participation')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [driveLink, setDriveLink] = useState('')

  // Step 4: Name style
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0].label)
  const [fontSize, setFontSize] = useState(120)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [fontColor, setFontColor] = useState('#111111')

  // Step 5: Placement
  const [placeMode, setPlaceMode] = useState('name') // 'name', 'qr', 'id'
  const [namePos, setNamePos] = useState({ x: 0, y: 0 })
  const [qrPos, setQrPos] = useState({ x: 0, y: 0 })
  const [qrSize, setQrSize] = useState(250)
  const [idPos, setIdPos] = useState({ x: 0, y: 0 })
  const [idSize, setIdSize] = useState(26)
  const [showId, setShowId] = useState(true)

  // QR preview state
  const [previewQrCanvas, setPreviewQrCanvas] = useState(null)

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [runNotice, setRunNotice] = useState(null) // { type: 'success'|'error'|'warn', message: '' }
  const [runFailures, setRunFailures] = useState([])

  const previewCanvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // Resolve computed font family
  const resolveFontFamily = useCallback((fontName) => {
    const found = FONT_OPTIONS.find(f => f.label === fontName)
    if (!found) return 'sans-serif'
    if (found.familyVar && typeof window !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue(found.familyVar).trim()
      if (computed) return `${computed}, ${found.fallback}`
    }
    return found.fallback
  }, [])

  // Build canvas font string
  const getCanvasFontString = useCallback((size) => {
    const family = resolveFontFamily(selectedFont)
    const weight = isBold ? 'bold' : 'normal'
    const style = isItalic ? 'italic' : 'normal'
    return `${style} ${weight} ${size}px ${family}`
  }, [selectedFont, isBold, isItalic, resolveFontFamily])

  // Handle template file upload
  const handleTemplateUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setRunNotice({ type: 'error', message: 'That file could not be read as an image.' })
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      setTemplateFile(file)
      setTemplateImg(img)
      setTemplateDimensions({ w, h })

      // Scaled defaults according to spec
      setNamePos({ x: Math.round(w / 2), y: Math.round(h / 2) })
      setFontSize(Math.max(20, Math.round(w / 22)))

      const defaultQr = Math.round(Math.min(w, h) * 0.13)
      setQrSize(defaultQr)
      setQrPos({
        x: Math.round(w - defaultQr - 0.05 * w),
        y: Math.round(h - defaultQr - 0.06 * h)
      })

      setIdPos({
        x: Math.round(0.05 * w),
        y: Math.round(0.94 * h)
      })
      setIdSize(Math.max(10, Math.round(w / 95)))
    }
    img.src = objectUrl
  }

  // Handle CSV upload
  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rows = results.data || []
        if (rows.length === 0) {
          setCsvErrors(['The CSV has no data rows.'])
          setRecipients([])
          return
        }

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const parsed = []
        const errors = []

        rows.forEach((row, idx) => {
          const rowNum = idx + 2
          // Aliases matching
          const nameKey = Object.keys(row).find(k => ['name', 'full name', 'fullname', 'full_name'].includes(k.trim().toLowerCase()))
          const emailKey = Object.keys(row).find(k => ['email', 'mail', 'email address', 'email_address'].includes(k.trim().toLowerCase()))
          const codeKey = Object.keys(row).find(k => ['code', 'team code', 'teamcode', 'team_code', 'team', 'event code', 'event_code', 'event'].includes(k.trim().toLowerCase()))

          const name = nameKey ? String(row[nameKey] || '').trim() : ''
          const email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : ''
          const code = codeKey ? String(row[codeKey] || '').trim().toUpperCase() : ''

          if (!name) {
            errors.push(`Row ${rowNum}: Name is missing`)
            return
          }
          if (!email || !EMAIL_REGEX.test(email)) {
            errors.push(`Row ${rowNum}: Invalid email address (${email || 'empty'})`)
            return
          }
          if (!code) {
            errors.push(`Row ${rowNum}: Event code is missing`)
            return
          }

          parsed.push({ name, email, code })
        })

        if (errors.length > 0) {
          setCsvErrors(errors)
          setRecipients([])
        } else {
          setCsvErrors([])
          setRecipients(parsed)
        }
      }
    })
  }

  // Generate preview QR code
  useEffect(() => {
    let cancelled = false
    const offscreen = document.createElement('canvas')
    QRCode.toCanvas(offscreen, 'https://dbuglabs.org/verify/SAMPLE', {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'M'
    }).then(() => {
      if (!cancelled) setPreviewQrCanvas(offscreen)
    }).catch(console.error)

    return () => { cancelled = true }
  }, [qrSize])

  // Repaint preview canvas
  const paint = useCallback((ctx, img, options) => {
    const { name, credentialId, qrCanvas } = options
    const { w, h } = templateDimensions

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    // Name
    ctx.font = getCanvasFontString(fontSize)
    ctx.fillStyle = fontColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, namePos.x, namePos.y)

    // Credential ID
    if (showId && credentialId) {
      ctx.font = `${idSize}px monospace`
      ctx.fillStyle = fontColor
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(credentialId, idPos.x, idPos.y)
    }

    // QR
    if (qrCanvas) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(qrCanvas, qrPos.x, qrPos.y, qrSize, qrSize)
      ctx.imageSmoothingEnabled = true
    }
  }, [templateDimensions, getCanvasFontString, fontSize, fontColor, namePos, showId, idSize, idPos, qrPos, qrSize])

  // Redraw preview whenever state changes
  useEffect(() => {
    if (!templateImg || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    canvas.width = templateDimensions.w
    canvas.height = templateDimensions.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const previewName = recipientMode === 'csv'
      ? (recipients[0]?.name || 'Sample Name')
      : (singlePerson.name || 'Sample Name')

    const firstCode = recipientMode === 'csv'
      ? (recipients[0]?.code || 'CODE')
      : (singlePerson.code || 'CODE')

    const yy = new Date().getFullYear().toString().slice(-2)
    const previewId = `DBUG-${firstCode}-${yy}-0001`

    // Ensure font is ready before draw
    const fontStr = getCanvasFontString(fontSize)
    if (document.fonts) {
      document.fonts.load(fontStr, previewName).then(() => {
        paint(ctx, templateImg, {
          name: previewName,
          credentialId: previewId,
          qrCanvas: previewQrCanvas
        })
      })
    } else {
      paint(ctx, templateImg, {
        name: previewName,
        credentialId: previewId,
        qrCanvas: previewQrCanvas
      })
    }
  }, [templateImg, templateDimensions, recipientMode, recipients, singlePerson, previewQrCanvas, getCanvasFontString, fontSize, paint])

  // Canvas click placement
  const handleCanvasClick = (e) => {
    if (!templateDimensions.w || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = templateDimensions.w / rect.width
    const clickX = Math.round((e.clientX - rect.left) * scale)
    const clickY = Math.round((e.clientY - rect.top) * scale)

    if (placeMode === 'name') {
      setNamePos({ x: clickX, y: clickY })
    } else if (placeMode === 'id') {
      setIdPos({ x: clickX, y: clickY })
    } else if (placeMode === 'qr') {
      // Center QR on click
      setQrPos({
        x: Math.round(clickX - qrSize / 2),
        y: Math.round(clickY - qrSize / 2)
      })
    }
  }

  // Active recipients to generate
  const effectiveRecipients = recipientMode === 'csv'
    ? recipients
    : (singlePerson.name && singlePerson.email && singlePerson.code ? [singlePerson] : [])

  const canGenerate = Boolean(
    templateImg &&
    title.trim() &&
    effectiveRecipients.length > 0 &&
    csvErrors.length === 0 &&
    !isGenerating
  )

  // Warn before closing tab while generating
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isGenerating) {
        e.preventDefault()
        e.returnValue = 'Certificates are still being generated.'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isGenerating])

  // Run generation
  const handleGenerate = async () => {
    if (!canGenerate) return
    setIsGenerating(true)
    setRunNotice(null)
    setRunFailures([])
    setProgressText('Reserving credential IDs…')

    try {
      // 1. Ensure font is fully loaded
      const fontStr = getCanvasFontString(fontSize)
      if (document.fonts) {
        await document.fonts.load(fontStr, 'Sample')
      }

      // 2. Reserve IDs in MongoDB via POST /api/certificates/batch
      const batchRes = await fetch('/api/certificates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: effectiveRecipients,
          type: certType,
          title,
          description: description || null,
          driveLink: driveLink || null
        })
      })

      const responseText = await batchRes.text()
      let batchData = {}
      try {
        batchData = JSON.parse(responseText)
      } catch {
        throw new Error(`Server returned status ${batchRes.status}: ${responseText || batchRes.statusText}`)
      }

      if (!batchRes.ok) {
        if (batchRes.status === 401) {
          throw new Error('Your session expired. Sign in again.')
        }
        if (batchData.invalid) {
          const detail = batchData.invalid.map(i => `Row ${i.row}: ${i.error}`).join('\n')
          throw new Error(`${batchData.error}:\n${detail}`)
        }
        throw new Error(batchData.error || `Server error (${batchRes.status})`)
      }

      const { batchId, issued } = batchData
      const totalCount = issued.length

      // 3. Render each certificate and add to ZIP
      const zip = new JSZip()
      const renderedItems = [] // for emailing

      const renderCanvas = document.createElement('canvas')
      renderCanvas.width = templateDimensions.w
      renderCanvas.height = templateDimensions.h
      const renderCtx = renderCanvas.getContext('2d')

      for (let i = 0; i < totalCount; i++) {
        const item = issued[i]
        setProgressText(`Rendering certificates… ${i + 1} / ${totalCount}`)

        // Render QR with verifyUrl
        const qrCanvas = document.createElement('canvas')
        await QRCode.toCanvas(qrCanvas, item.verifyUrl, {
          width: qrSize,
          margin: 1,
          errorCorrectionLevel: 'M'
        })

        // Paint
        paint(renderCtx, templateImg, {
          name: item.issuedToName,
          credentialId: item.credentialId,
          qrCanvas
        })

        // High-res PNG for ZIP
        const pngDataUrl = renderCanvas.toDataURL('image/png')
        const pngBase64 = pngDataUrl.split(',')[1]
        const safeFilename = `${item.issuedToName.replace(/[^\w]/g, '_')}_${item.credentialId}.png`
        zip.file(safeFilename, pngBase64, { base64: true })

        // Check mail size constraint (compress to JPEG if needed)
        let mailBase64 = pngBase64
        let mailMime = 'image/png'

        if (mailBase64.length > 3400000) {
          for (const q of [0.92, 0.80, 0.65]) {
            const jpegDataUrl = renderCanvas.toDataURL('image/jpeg', q)
            const jpegBase64 = jpegDataUrl.split(',')[1]
            mailBase64 = jpegBase64
            mailMime = 'image/jpeg'
            if (mailBase64.length <= 3400000) break
          }
        }

        renderedItems.push({
          credentialId: item.credentialId,
          name: item.issuedToName,
          email: item.issuedToEmail,
          imageBase64: mailBase64,
          mimeType: mailMime
        })
      }

      // 4. Download ZIP immediately
      setProgressText('Building the ZIP…')
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const downloadLink = document.createElement('a')
      downloadLink.href = URL.createObjectURL(zipBlob)
      downloadLink.download = `dBugLabs_Certificates_${batchId}.zip`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)

      // 5. Send emails in chunks (<= 3 items, <= 3.4MB)
      let sentTotal = 0
      const failures = []

      const chunks = []
      let currentChunk = []
      let currentChunkSize = 0

      for (const item of renderedItems) {
        const itemSize = item.imageBase64.length
        if (currentChunk.length >= 3 || (currentChunkSize + itemSize > 3400000 && currentChunk.length > 0)) {
          chunks.push(currentChunk)
          currentChunk = [item]
          currentChunkSize = itemSize
        } else {
          currentChunk.push(item)
          currentChunkSize += itemSize
        }
      }
      if (currentChunk.length > 0) chunks.push(currentChunk)

      let processedRecipients = 0
      for (const chunk of chunks) {
        setProgressText(`Sending emails… ${processedRecipients} / ${totalCount} · ${sentTotal} accepted`)

        try {
          const sendRes = await fetch('/api/certificates/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batchId,
              items: chunk.map(c => ({
                credentialId: c.credentialId,
                imageBase64: c.imageBase64,
                mimeType: c.mimeType
              }))
            })
          })

          const sendText = await sendRes.text()
          let sendData = {}
          try {
            sendData = JSON.parse(sendText)
          } catch {
            sendData = { error: `Server error (${sendRes.status}): ${sendText || sendRes.statusText}` }
          }

          if (!sendRes.ok) {
            chunk.forEach(c => failures.push({ credentialId: c.credentialId, name: c.name, error: sendData.error || 'Server rejected chunk' }))
          } else {
            sentTotal += sendData.sent || 0
            if (sendData.failed) {
              sendData.failed.forEach(f => {
                const matched = chunk.find(c => c.credentialId === f.credentialId)
                failures.push({ credentialId: f.credentialId, name: matched?.name || f.credentialId, error: f.error })
              })
            }
            if (sendData.dead) {
              sendData.dead.forEach(d => {
                const matched = chunk.find(c => c.credentialId === d.credentialId)
                failures.push({ credentialId: d.credentialId, name: matched?.name || d.credentialId, error: d.error })
              })
            }
          }
        } catch (netErr) {
          chunk.forEach(c => failures.push({ credentialId: c.credentialId, name: c.name, error: netErr.message }))
        }

        processedRecipients += chunk.length
      }

      setProgressText(`Sending emails… ${totalCount} / ${totalCount} · ${sentTotal} accepted · ${failures.length} failed`)

      if (failures.length === 0) {
        setRunNotice({
          type: 'success',
          message: `All ${totalCount} certificates generated, downloaded in ZIP and emailed!`
        })
      } else {
        setRunFailures(failures)
        setRunNotice({
          type: 'warn',
          message: `${sentTotal} of ${totalCount} accepted by mail server. ${failures.length} delivery errors queued in outbox for retry.`
        })
      }
    } catch (err) {
      setRunNotice({ type: 'error', message: err.message || 'Generation failed' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '2px', color: 'var(--red)', textTransform: 'uppercase' }}>
          Module 01
        </div>
        <h1 className="heading-font display-title" style={{ fontSize: '28px', margin: '4px 0' }}>
          Certificate Generator
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          Design once, issue to everyone, with a QR that proves each one is real.
        </p>
      </div>

      {runNotice && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: runNotice.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : runNotice.type === 'warn' ? 'rgba(243, 156, 18, 0.15)' : 'rgba(255, 45, 79, 0.15)',
            border: `1px solid ${runNotice.type === 'success' ? '#2ecc71' : runNotice.type === 'warn' ? '#f39c12' : 'var(--red)'}`,
            color: '#fff',
            fontSize: '14px'
          }}
        >
          {runNotice.message}
          {runFailures.length > 0 && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)' }}>
              <strong>Failed items:</strong>
              <ul style={{ marginTop: '4px', paddingLeft: '20px' }}>
                {runFailures.slice(0, 5).map((f, i) => (
                  <li key={i}>{f.name} ({f.credentialId}): {f.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main split grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 400px) 1fr',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Controls Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Step 1: Template */}
          <div className="panel-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>① Template</h3>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleTemplateUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              {templateFile ? 'Change Template Image' : 'Select Template Image'}
            </button>
            {templateDimensions.w > 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {templateFile.name} ({templateDimensions.w} × {templateDimensions.h} px)
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--dim)' }}>
                Recommended: Landscape A4 at 150–300 dpi (3508 × 2480 px)
              </div>
            )}
          </div>

          {/* Step 2: Recipients */}
          <div className="panel-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: '#fff' }}>② Recipients</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={recipientMode === 'csv' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setRecipientMode('csv')}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className={recipientMode === 'single' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => setRecipientMode('single')}
                >
                  Single
                </button>
              </div>
            </div>

            {recipientMode === 'csv' ? (
              <div key="mode-csv">
                <input
                  key="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ fontSize: '13px', color: 'var(--muted)', width: '100%', marginBottom: '8px' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>
                  Required columns: <code>name</code>, <code>email</code>, <code>code</code>
                </div>
                {recipients.length > 0 && (
                  <div style={{ color: '#2ecc71', fontSize: '13px', fontWeight: 600 }}>
                    ✓ {recipients.length} recipients loaded
                  </div>
                )}
                {csvErrors.length > 0 && (
                  <div style={{ color: 'var(--red-soft)', fontSize: '12px', marginTop: '6px' }}>
                    {csvErrors.slice(0, 5).map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key="mode-single" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  key="single-name-input"
                  type="text"
                  placeholder="Full Name"
                  className="input-field"
                  value={singlePerson.name || ''}
                  onChange={(e) => setSinglePerson((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  key="single-email-input"
                  type="email"
                  placeholder="Email"
                  className="input-field"
                  value={singlePerson.email || ''}
                  onChange={(e) => setSinglePerson((prev) => ({ ...prev, email: e.target.value }))}
                />
                <input
                  key="single-code-input"
                  type="text"
                  placeholder="Code (e.g. WS)"
                  className="input-field"
                  value={singlePerson.code || ''}
                  onChange={(e) => setSinglePerson((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                />
              </div>
            )}
          </div>

          {/* Step 3: Details */}
          <div className="panel-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff' }}>③ Details</h3>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Type</label>
              <select
                className="input-field"
                value={certType}
                onChange={(e) => setCertType(e.target.value)}
                style={{ marginTop: '4px' }}
              >
                <option value="participation">Participation</option>
                <option value="completion">Completion</option>
                <option value="appreciation">Appreciation</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Event Title *</label>
              <input
                type="text"
                placeholder="Title (e.g. Git & GitHub Workshop)"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Description (Optional)</label>
              <input
                type="text"
                placeholder="Brief summary or date"
                className="input-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Drive Folder Link (Optional)</label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                className="input-field"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          {/* Step 4: Name style */}
          <div className="panel-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff' }}>④ Name Style</h3>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Font</label>
              <select
                className="input-field"
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                style={{ marginTop: '4px' }}
              >
                {FONT_OPTIONS.map(f => (
                  <option key={f.label} value={f.label}>{f.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Size (px)</label>
                <input
                  type="number"
                  min="8"
                  max="400"
                  className="input-field"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 40)}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Colour</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: '36px', height: '36px', cursor: 'pointer' }}
                  />
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>{fontColor}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={isBold ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, padding: '6px' }}
                onClick={() => setIsBold(!isBold)}
              >
                Bold
              </button>
              <button
                type="button"
                className={isItalic ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, padding: '6px' }}
                onClick={() => setIsItalic(!isItalic)}
              >
                Italic
              </button>
            </div>
          </div>

          {/* Step 5: Placement */}
          <div className="panel-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', color: '#fff' }}>⑤ Placement</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className={placeMode === 'name' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 4px', fontSize: '12px' }}
                onClick={() => setPlaceMode('name')}
              >
                Name
              </button>
              <button
                type="button"
                className={placeMode === 'qr' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 4px', fontSize: '12px' }}
                onClick={() => setPlaceMode('qr')}
              >
                QR Code
              </button>
              <button
                type="button"
                className={placeMode === 'id' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 4px', fontSize: '12px' }}
                onClick={() => setPlaceMode('id')}
              >
                Cred ID
              </button>
            </div>

            {placeMode === 'name' && (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Click preview to place name center:
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="number"
                    className="input-field"
                    value={namePos.x}
                    onChange={(e) => setNamePos({ ...namePos, x: parseInt(e.target.value, 10) || 0 })}
                  />
                  <input
                    type="number"
                    className="input-field"
                    value={namePos.y}
                    onChange={(e) => setNamePos({ ...namePos, y: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                  onClick={() => setNamePos({ x: Math.round(templateDimensions.w / 2), y: namePos.y })}
                >
                  Center Horizontally
                </button>
              </div>
            )}

            {placeMode === 'qr' && (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                QR Size: {qrSize} px
                <input
                  type="range"
                  min="60"
                  max="600"
                  value={qrSize}
                  onChange={(e) => setQrSize(parseInt(e.target.value, 10))}
                  style={{ width: '100%', marginTop: '4px' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="number"
                    className="input-field"
                    value={qrPos.x}
                    onChange={(e) => setQrPos({ ...qrPos, x: parseInt(e.target.value, 10) || 0 })}
                  />
                  <input
                    type="number"
                    className="input-field"
                    value={qrPos.y}
                    onChange={(e) => setQrPos({ ...qrPos, y: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            )}

            {placeMode === 'id' && (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={showId}
                    onChange={(e) => setShowId(e.target.checked)}
                  />
                  Print Credential ID
                </label>
                ID Font Size: {idSize} px
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={idSize}
                  onChange={(e) => setIdSize(parseInt(e.target.value, 10))}
                  style={{ width: '100%', marginTop: '4px' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="number"
                    className="input-field"
                    value={idPos.x}
                    onChange={(e) => setIdPos({ ...idPos, x: parseInt(e.target.value, 10) || 0 })}
                  />
                  <input
                    type="number"
                    className="input-field"
                    value={idPos.y}
                    onChange={(e) => setIdPos({ ...idPos, y: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          {isGenerating && (
            <div className="panel-card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ color: 'var(--red-soft)', fontWeight: 600, fontSize: '14px' }}>
                {progressText}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '4px' }}>
                Keep this tab open until ZIP download starts
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={!canGenerate}
            onClick={handleGenerate}
            style={{ width: '100%', padding: '16px' }}
          >
            {isGenerating
              ? 'Generating…'
              : effectiveRecipients.length > 1
                ? `Generate, Download & Email (${effectiveRecipients.length})`
                : 'Generate, Download & Email'}
          </button>
        </div>

        {/* Live Preview Column */}
        <div
          className="panel-card"
          style={{
            padding: '20px',
            position: 'sticky',
            top: '84px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--muted)', letterSpacing: '1px' }}>
              Live Preview
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--purple-soft)', fontWeight: 600 }}>
              Placing: {placeMode.toUpperCase()}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              minHeight: '340px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px dashed var(--panel-border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: templateImg ? 'crosshair' : 'default'
            }}
          >
            {templateImg ? (
              <canvas
                ref={previewCanvasRef}
                onClick={handleCanvasClick}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  objectFit: 'contain',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--dim)', padding: '40px' }}>
                <p>Upload a template image on Step ① to start preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
