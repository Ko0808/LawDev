// src/components/TiptapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import { FontSize } from './FontSize'
import { useState } from 'react'
import './EditorStyles.css'

const TiptapEditor = () => {
    // 状態管理
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [, forceUpdate] = useState(0)
    const [currentPath, setCurrentPath] = useState<string | null>(null)
    const [isVertical, setIsVertical] = useState(false)
    const [gridSettings, setGridSettings] = useState({ chars: 35, lines: 22 })
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    // grid: マス目, line: 下線, outline: 外枠のみ, none: 設定なし
    const [genkoMode, setGenkoMode] = useState<'none' | 'grid' | 'line' | 'outline'>('line')

    // エディタ設定
    const editor = useEditor({
        extensions: [StarterKit, TextStyle, FontFamily, Color, FontSize],
        content: '<p></p>',
        onTransaction: () => forceUpdate((n) => n + 1),
    })

    // メニュー操作
    const toggleMenu = (menuName: string) => {
        setActiveMenu(activeMenu === menuName ? null : menuName)
    }
    const closeMenu = () => setActiveMenu(null)

    // --- ファイル操作 ---

    const handleSave = async () => {
        if (!editor) return
        const content = JSON.stringify(editor.getJSON())
        closeMenu()
        // @ts-ignore
        const result = await window.api.saveFile(content, currentPath)
        if (result.success) {
            setCurrentPath(result.filePath)
            alert('保存しました')
        } else if (result.error) {
            alert('エラー: ' + result.error)
        }
    }

    const handleSaveAs = async () => {
        if (!editor) return
        const content = JSON.stringify(editor.getJSON())
        closeMenu()
        // @ts-ignore
        const result = await window.api.saveFile(content)
        if (result.success) {
            setCurrentPath(result.filePath)
            alert('別名で保存しました')
        }
    }

    const handleOpen = async () => {
        closeMenu()
        // @ts-ignore
        const result = await window.api.openFile()
        if (result.canceled) return
        if (result.error) { alert('エラー: ' + result.error); return }
        if (result.content) {
            try {
                editor.commands.setContent(JSON.parse(result.content))
                setCurrentPath(result.filePath)
            } catch (e) { alert('ファイル破損') }
        }
    }

    const handlePrint = () => {
        closeMenu()
        window.print()
    }

    // --- レイアウト設定 ---

    const setDirection = (vertical: boolean) => {
        setIsVertical(vertical)
        closeMenu()
    }

    const applyGridSettings = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        setGridSettings({
            chars: Number(formData.get('chars')),
            lines: Number(formData.get('lines')),
        })
        setShowSettingsModal(false)
        closeMenu()
    }

    // --- スタイル計算 ---

    // 1. A4用紙の有効領域サイズ (mm -> px)
    const MM_TO_PX = 3.78
    const CONTENT_WIDTH_PX = 165 * MM_TO_PX // 横書き時の幅
    const CONTENT_HEIGHT_PX = 245 * MM_TO_PX // 縦書き時の高さ

    const isGenkoMode = genkoMode !== 'none'
    const userFontSize = editor ? (parseInt(editor.getAttributes('textStyle').fontSize) || 16) : 16
    const cellPadding = 6 // 文字と枠の間の最低余白

    // 2. 「両端揃え」のための計算
    let exactCellSize = userFontSize + cellPadding

    if (isGenkoMode) {
        const targetLength = isVertical ? CONTENT_HEIGHT_PX : CONTENT_WIDTH_PX
        exactCellSize = targetLength / gridSettings.chars
    }

    // 3. フォントサイズと文字間隔の決定
    const effectiveFontSize = isGenkoMode
        ? Math.floor(exactCellSize - cellPadding)
        : userFontSize

    // 文字間隔
    const exactLetterSpacing = isGenkoMode
        ? exactCellSize - effectiveFontSize
        : 0

    // 文字をマスの真ん中に置くためのズレ量 (半マス分)
    const halfGap = isGenkoMode ? (exactCellSize - effectiveFontSize) / 2 : 0

    // 行の高さ計算
    const lineHeightRatio = 1.75
    const lineHeightPx = Math.max(effectiveFontSize * lineHeightRatio, exactCellSize + 2)

    // 背景生成ロジック
    const getGenkoBackground = () => {
        const lineColor = '#8bc34a'
        const outlineColor = '#ccc'

        // 視覚調整
        const adjustmentY = -2

        switch (genkoMode) {
            case 'grid': // マス目
                const boxSize = exactCellSize
                let svgString = ''
                let bgSize = ''

                if (isVertical) {
                    const width = lineHeightPx
                    const height = exactCellSize
                    const offsetX = (lineHeightPx - exactCellSize) / 2

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="${offsetX}" y="0" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${lineHeightPx}px ${exactCellSize}px`
                } else {
                    const width = exactCellSize
                    const height = lineHeightPx
                    const offsetY = (lineHeightPx - exactCellSize) / 2

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0" y="${offsetY}" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${exactCellSize}px ${lineHeightPx}px`
                }

                const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgString.replace(/\s+/g, ' ').trim())}`

                return {
                    backgroundImage: `url("${svgDataUrl}")`,
                    backgroundSize: bgSize,
                    backgroundPosition: isVertical
                        ? `right top ${adjustmentY}px`
                        : `left top ${adjustmentY}px`,
                    border: `1px solid ${outlineColor}`
                }

            case 'line': // 下線
                const cssLineColor = '#e0e0e0'
                if (isVertical) {
                    return {
                        backgroundImage: `repeating-linear-gradient(to left, transparent, transparent ${lineHeightPx - 1}px, ${cssLineColor} ${lineHeightPx}px)`,
                        border: `1px solid ${outlineColor}`
                    }
                } else {
                    return {
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${lineHeightPx - 1}px, ${cssLineColor} ${lineHeightPx}px)`,
                        border: `1px solid ${outlineColor}`
                    }
                }

            case 'outline': return { backgroundImage: 'none', border: `1px solid ${outlineColor}` }
            case 'none': default: return { backgroundImage: 'none', border: 'none' }
        }
    }

    const backgroundStyle = getGenkoBackground()

    // 4. エディタ領域のスタイル適用
    const editorStyle = isVertical
        ? {
            // ■ 縦書き
            writingMode: 'vertical-rl' as const,

            // content-boxにより、このheightは「中身の文字が入るエリア」だけを指すようになる
            height: isGenkoMode ? `${exactCellSize * gridSettings.chars}px` : 'auto',
            minWidth: isGenkoMode ? `${lineHeightPx * gridSettings.lines}px` : '100%',
            minHeight: isGenkoMode ? 'auto' : `${CONTENT_HEIGHT_PX}px`,

            fontSize: `${effectiveFontSize}px`,
            lineHeight: `${lineHeightPx}px`,
            letterSpacing: isGenkoMode ? `${exactLetterSpacing}px` : 'normal',

            // ★修正: border-box から content-box へ変更
            // これで「borderの幅」がサイズ計算から除外され、文字エリアが狭くなるのを防ぎます
            padding: 0,
            boxSizing: 'content-box' as const,

            margin: '50px 50px 50px auto',
            wordBreak: 'break-all' as const,
        }
        : {
            // ■ 横書き
            writingMode: 'horizontal-tb' as const,

            // content-boxにより、このwidthは「中身の文字が入るエリア」だけを指すようになる
            width: isGenkoMode ? `${exactCellSize * gridSettings.chars}px` : '100%',
            maxWidth: isGenkoMode ? 'none' : `${CONTENT_WIDTH_PX}px`,
            minHeight: isGenkoMode ? `${lineHeightPx * gridSettings.lines}px` : `${CONTENT_HEIGHT_PX}px`,

            fontSize: `${effectiveFontSize}px`,
            lineHeight: `${lineHeightPx}px`,
            letterSpacing: isGenkoMode ? `${exactLetterSpacing}px` : 'normal',

            // ★修正: border-box から content-box へ変更
            padding: 0,
            boxSizing: 'content-box' as const,

            margin: '50px auto',
            wordBreak: 'break-all' as const,
        }

    if (!editor) return null

    return (
        <div className="editor-container">
            {/* ... (モーダル・メニューバーは変更なし) ... */}
            {showSettingsModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>ページ設定 (Page Setup)</h3>
                        <form onSubmit={applyGridSettings}>
                            <div className="input-group">
                                <label>行の文字数 (Chars per line):</label>
                                <input name="chars" type="number" defaultValue={gridSettings.chars} min="10" max="100" />
                            </div>
                            <div className="input-group">
                                <label>ページの行数 (Lines per page):</label>
                                <input name="lines" type="number" defaultValue={gridSettings.lines} min="5" max="100" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                                <button type="submit" className="primary">OK</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="menu-bar">
                <div className="menu-item">
                    <button className={`menu-trigger ${activeMenu === 'file' ? 'active' : ''}`} onClick={() => toggleMenu('file')}>File</button>
                    {activeMenu === 'file' && (
                        <div className="dropdown-menu">
                            <button onClick={handleOpen}>Open...</button>
                            <button onClick={handleSave}>Save</button>
                            <button onClick={handleSaveAs}>Save As...</button>
                            <button onClick={handlePrint}>Print</button>
                        </div>
                    )}
                </div>

                <div className="menu-item">
                    <button className={`menu-trigger ${activeMenu === 'layout' ? 'active' : ''}`} onClick={() => toggleMenu('layout')}>Layout</button>
                    {activeMenu === 'layout' && (
                        <div className="dropdown-menu" style={{ width: '220px' }}>
                            <button onClick={() => setDirection(false)}>横書き (Horizontal)</button>
                            <button onClick={() => setDirection(true)}>縦書き (Vertical)</button>
                            <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #eee' }} />
                            <div style={{ padding: '5px 15px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Grid Style</div>
                            <button onClick={() => { setGenkoMode('grid'); closeMenu(); }}>マス目 (Grid)</button>
                            <button onClick={() => { setGenkoMode('line'); closeMenu(); }}>下線 (Line)</button>
                            <button onClick={() => { setGenkoMode('outline'); closeMenu(); }}>外枠 (Outline)</button>
                            <button onClick={() => { setGenkoMode('none'); closeMenu(); }}>なし (None)</button>
                            <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #eee' }} />
                            <button onClick={() => { setShowSettingsModal(true); closeMenu() }}>ページ設定 (Page Setup)...</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="toolbar">
                <select
                    className="toolbar-select"
                    onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                    value={editor.getAttributes('textStyle').fontFamily || ''}
                >
                    <option value="" disabled>Font</option>
                    <option value="Inter">Inter</option>
                    <option value="MS Mincho">MS 明朝</option>
                    <option value="MS Gothic">MS ゴシック</option>
                </select>

                <select
                    className="toolbar-select"
                    onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                    value={isGenkoMode ? effectiveFontSize.toString() : (editor.getAttributes('textStyle').fontSize || '')}
                    disabled={isGenkoMode}
                    style={{
                        opacity: isGenkoMode ? 0.6 : 1,
                        cursor: isGenkoMode ? 'not-allowed' : 'pointer',
                        backgroundColor: isGenkoMode ? '#f0f0f0' : 'white'
                    }}
                >
                    <option value="" disabled>Size</option>
                    <option value="12">12px</option>
                    <option value="16">16px</option>
                    <option value="20">20px</option>
                    <option value="24">24px</option>
                    {isGenkoMode && <option value={effectiveFontSize}>{effectiveFontSize}px (Auto)</option>}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="color"
                        onInput={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
                        value={editor.getAttributes('textStyle').color || '#000000'}
                        style={{ height: '30px', width: '30px', cursor: 'pointer', padding: '0', border: 'none', background: 'none' }}
                        title="文字色を変更"
                    />
                </div>
                <div className="divider" style={{ width: '1px', background: '#ccc', margin: '0 10px' }}></div>
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} style={{ fontWeight: 'bold' }}>B</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>List</button>
            </div>

            {/* --- 作業エリア (Workspace) --- */}
            <div className={`editor-workspace ${isVertical ? 'vertical-mode' : ''}`} onClick={closeMenu}>
                <div className="editor-paper">
                    <div
                        className="editor-layout-area"
                        style={{
                            ...editorStyle,
                            ...backgroundStyle,
                            fontFamily: '"MS Gothic", "Courier New", monospace',
                        }}
                    >
                        <div style={{
                            width: '100%',
                            height: '100%',
                            transform: isGenkoMode
                                ? (isVertical
                                    ? `translateY(${halfGap}px)`
                                    : `translateX(${halfGap}px)`)
                                : 'none'
                        }}>
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TiptapEditor