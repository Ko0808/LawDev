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
    const [gridSettings, setGridSettings] = useState({ chars: 20, lines: 20 })
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [genkoMode, setGenkoMode] = useState<'none' | 'grid' | 'line' | 'outline'>('line')
    const [zoomLevel, setZoomLevel] = useState(100) // ズーム倍率 (%)

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

        if (genkoMode === 'grid') {
            const preset = formData.get('gridPreset') as string
            const [chars, lines] = preset.split('x').map(Number)
            setGridSettings({ chars, lines })
        } else {
            setGridSettings({
                chars: Number(formData.get('chars')),
                lines: Number(formData.get('lines')),
            })
        }

        setShowSettingsModal(false)
        closeMenu()
    }

    // --- スタイル計算 (修正版: 行間計算の追加) ---

    const MM_TO_PX = 3.78
    // 用紙の有効領域（余白を除いた描画可能エリア）
    const MAX_CONTENT_WIDTH_PX = 165 * MM_TO_PX
    const MAX_CONTENT_HEIGHT_PX = 245 * MM_TO_PX

    const isGenkoMode = genkoMode !== 'none'
    const userFontSize = editor ? (parseInt(editor.getAttributes('textStyle').fontSize) || 16) : 16
    const cellPadding = 6

    // 1. マス目サイズ（文字方向のサイズ）
    // 横書きなら幅÷文字数、縦書きなら高さ÷文字数
    let cellSizeInt = userFontSize + cellPadding

    if (isGenkoMode) {
        const targetLength = isVertical ? MAX_CONTENT_HEIGHT_PX : MAX_CONTENT_WIDTH_PX
        cellSizeInt = Math.floor(targetLength / gridSettings.chars)
    }

    // 2. 行の高さ（行送り方向のサイズ）★ここが重要
    // 横書きなら高さ÷行数、縦書きなら幅÷行数
    let lineHeightPx = Math.floor(Math.max(cellSizeInt * 1.75, cellSizeInt + 2))

    if (isGenkoMode) {
        const targetLengthForLines = isVertical ? MAX_CONTENT_WIDTH_PX : MAX_CONTENT_HEIGHT_PX
        // ページ全体のサイズを行数で割ることで、10行指定なら行間が広く、20行なら狭くなります
        lineHeightPx = Math.floor(targetLengthForLines / gridSettings.lines)
    }

    // 3. 実際のコンテンツエリアサイズを確定
    // 計算された「マスサイズ」と「行サイズ」を積み上げたものをエディタのサイズとします
    const actualContentWidth = isVertical
        ? lineHeightPx * gridSettings.lines // 縦書きの幅 ＝ 行幅 × 行数
        : cellSizeInt * gridSettings.chars  // 横書きの幅 ＝ 文字幅 × 文字数

    const actualContentHeight = isVertical
        ? cellSizeInt * gridSettings.chars  // 縦書きの高さ ＝ 文字高 × 文字数
        : lineHeightPx * gridSettings.lines // 横書きの高さ ＝ 行高 × 行数

    // 4. フォントサイズと文字間隔の決定
    const effectiveFontSize = isGenkoMode
        ? cellSizeInt - cellPadding
        : userFontSize

    const exactLetterSpacing = isGenkoMode
        ? cellSizeInt - effectiveFontSize
        : 0

    // 文字をマスの真ん中に置くための調整
    const halfGap = isGenkoMode ? Math.floor((cellSizeInt - effectiveFontSize) / 2) : 0

    // 背景生成ロジック
    const getGenkoBackground = () => {
        const lineColor = '#8bc34a'
        const outlineColor = '#ccc'
        const adjustmentY = -2

        switch (genkoMode) {
            case 'grid': // マス目
                const boxSize = cellSizeInt
                // 行の高さ(lineHeightPx)が大きい場合、マス(boxSize)は中央に配置される

                let svgString = ''
                let bgSize = ''

                if (isVertical) {
                    const width = lineHeightPx
                    const height = cellSizeInt
                    // 行幅の中でマスを中央寄せ
                    const offsetX = Math.floor((lineHeightPx - cellSizeInt) / 2)

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="${offsetX}" y="0" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${lineHeightPx}px ${cellSizeInt}px`
                } else {
                    const width = cellSizeInt
                    const height = lineHeightPx
                    // 行高の中でマスを中央寄せ
                    const offsetY = Math.floor((lineHeightPx - cellSizeInt) / 2)

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0" y="${offsetY}" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${cellSizeInt}px ${lineHeightPx}px`
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

    // 5. エディタ領域のスタイル適用
    const editorStyle = isVertical
        ? {
            // ■ 縦書き
            writingMode: 'vertical-rl' as const,

            // 行数計算の結果 + 1pxの余裕
            height: isGenkoMode ? `${actualContentHeight + 1}px` : 'auto',
            minWidth: isGenkoMode ? `${actualContentWidth}px` : '100%', // ここも計算値を使用
            minHeight: isGenkoMode ? 'auto' : `${MAX_CONTENT_HEIGHT_PX}px`,

            fontSize: `${effectiveFontSize}px`,
            lineHeight: `${lineHeightPx}px`,
            letterSpacing: isGenkoMode ? `${exactLetterSpacing}px` : 'normal',

            padding: 0,
            boxSizing: 'content-box' as const,
            margin: '50px 50px 50px auto',
            wordBreak: 'break-all' as const,

            fontFeatureSettings: '"palt" 0',
            fontKerning: 'none',
            fontVariantEastAsian: 'full-width',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: '"MS Gothic", "Hiragino Kaku Gothic ProN", monospace',
        }
        : {
            // ■ 横書き
            writingMode: 'horizontal-tb' as const,

            width: isGenkoMode ? `${actualContentWidth + 1}px` : '100%',
            maxWidth: isGenkoMode ? 'none' : `${MAX_CONTENT_WIDTH_PX}px`,
            // 行数計算の結果を使用
            minHeight: isGenkoMode ? `${actualContentHeight}px` : `${MAX_CONTENT_HEIGHT_PX}px`,

            fontSize: `${effectiveFontSize}px`,
            lineHeight: `${lineHeightPx}px`,
            letterSpacing: isGenkoMode ? `${exactLetterSpacing}px` : 'normal',

            padding: 0,
            boxSizing: 'content-box' as const,
            margin: '50px auto',
            wordBreak: 'break-all' as const,

            fontFeatureSettings: '"palt" 0',
            fontKerning: 'none',
            fontVariantEastAsian: 'full-width',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: isGenkoMode
                ? '"MS Gothic", "Hiragino Kaku Gothic ProN", monospace'
                : '"Inter", "MS Mincho", sans-serif',
        }

    return (
        <div className="editor-container">
            {/* ... (モーダル以外は変更なし) ... */}
            {showSettingsModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>ページ設定 (Page Setup)</h3>
                        <form onSubmit={applyGridSettings}>

                            {genkoMode === 'grid' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ marginBottom: '10px', fontSize: '14px', color: '#555' }}>
                                        原稿用紙モード (Grid Mode)
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="gridPreset"
                                            value="20x20"
                                            defaultChecked={gridSettings.chars === 20 && gridSettings.lines === 20}
                                            style={{ marginRight: '10px' }}
                                        />
                                        <span>400字詰 (20字 × 20行)</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="gridPreset"
                                            value="20x10"
                                            defaultChecked={gridSettings.chars === 20 && gridSettings.lines === 10}
                                            style={{ marginRight: '10px' }}
                                        />
                                        <span>200字詰 (20字 × 10行)</span>
                                    </label>
                                </div>
                            ) : (
                                <>
                                    <div className="input-group">
                                        <label>行の文字数 (Chars per line):</label>
                                        <input name="chars" type="number" defaultValue={gridSettings.chars} min="10" max="100" />
                                    </div>
                                    <div className="input-group">
                                        <label>ページの行数 (Lines per page):</label>
                                        <input name="lines" type="number" defaultValue={gridSettings.lines} min="5" max="100" />
                                    </div>
                                </>
                            )}

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

                <select
                    className="toolbar-select"
                    onChange={(e) => setZoomLevel(Number(e.target.value))}
                    value={zoomLevel}
                    title="Zoom"
                >
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="125">125%</option>
                    <option value="150">150%</option>
                    <option value="200">200%</option>
                </select>
                <div className="divider" style={{ width: '1px', background: '#ccc', margin: '0 10px' }}></div>
                <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} style={{ fontWeight: 'bold' }}>B</button>
                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}>H1</button>
                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''}>List</button>
            </div>

            {/* --- 作業エリア (Workspace) --- */}
            <div
                className={`editor-workspace ${isVertical ? 'vertical-mode' : ''}`}
                onClick={closeMenu}
                onWheel={(e) => {
                    if (e.ctrlKey) {
                        e.preventDefault()
                        const delta = e.deltaY > 0 ? -10 : 10
                        setZoomLevel(prev => {
                            const newLevel = prev + delta
                            // 50% 〜 200% の範囲に制限
                            return Math.min(Math.max(newLevel, 50), 200)
                        })
                    }
                }}
            >
                <div
                    className="editor-paper"
                    // @ts-ignore
                    style={{ zoom: zoomLevel / 100 }}
                >
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