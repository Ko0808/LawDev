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
        extensions: [StarterKit, TextStyle, FontFamily, Color, FontSize], content: '<p>ここに入力してください...</p>',
        onTransaction: () => forceUpdate((n) => n + 1),
    })

    // メニュー操作
    const toggleMenu = (menuName: string) => {
        setActiveMenu(activeMenu === menuName ? null : menuName)
    }
    const closeMenu = () => setActiveMenu(null)

    // --- ファイル操作 (復活！) ---

    // 上書き保存
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

    // 名前を付けて保存
    const handleSaveAs = async () => {
        if (!editor) return
        const content = JSON.stringify(editor.getJSON())
        closeMenu()

        // @ts-ignore
        // 第2引数を渡さないことで強制的にダイアログを出す
        const result = await window.api.saveFile(content)

        if (result.success) {
            setCurrentPath(result.filePath)
            alert('別名で保存しました')
        }
    }

    // 開く
    const handleOpen = async () => {
        closeMenu()
        // @ts-ignore
        const result = await window.api.openFile()

        if (result.canceled) return
        if (result.error) {
            alert('エラー: ' + result.error)
            return
        }

        if (result.content) {
            try {
                editor.commands.setContent(JSON.parse(result.content))
                setCurrentPath(result.filePath)
            } catch (e) {
                alert('ファイル破損')
            }
        }
    }

    // 印刷
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

    const currentFontSize = editor ? (parseInt(editor.getAttributes('textStyle').fontSize) || 16) : 16
    const cellPadding = 6
    const cellSize = currentFontSize + cellPadding
    const lineHeightRatio = 1.75
    const lineHeightPx = Math.max(currentFontSize * lineHeightRatio, cellSize + 2)
    const getGenkoBackground = () => {
        // 画像に合わせた緑色系の設定
        // #c8e6c9 は薄い緑色です。お好みで変更してください。
        const lineColor = '#8bc34a' // URLエンコードした #8bc34a (Light Green)
        const outlineColor = '#ccc'
        const adjustmentY = -2

        switch (genkoMode) {
            case 'grid': // マス目 (Grid)
                // 文字サイズちょうどの正方形
                const boxSize = cellSize
                const halfPad = cellPadding / 2


                // SVGパターンの生成
                let svgString = ''
                let bgSize = ''

                if (isVertical) {
                    // ■ 縦書き用: 横に広いタイル（行間を含む）、縦は1文字分
                    // タイルサイズ: 幅=行の高さ, 高さ=文字サイズ
                    const width = lineHeightPx
                    const height = cellSize

                    // 正方形を中央（行の真ん中）に配置
                    // x = (行の高さ - 文字サイズ) / 2
                    const offsetX = (lineHeightPx - currentFontSize) / 2

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="${offsetX}" y="0" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${lineHeightPx}px ${cellSize}px`
                } else {
                    // ■ 横書き用: 縦に長いタイル（行間を含む）、横は1文字分
                    // タイルサイズ: 幅=文字サイズ, 高さ=行の高さ
                    const width = cellSize
                    const height = lineHeightPx

                    // 正方形を中央（行の真ん中）に配置
                    // y = (行の高さ - 文字サイズ) / 2
                    const offsetY = (lineHeightPx - currentFontSize) / 2

                    svgString = `
                        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0" y="${offsetY}" width="${boxSize}" height="${boxSize}" 
                                  fill="none" stroke="${lineColor}" stroke-width="1"/>
                        </svg>
                    `
                    bgSize = `${cellSize}px ${lineHeightPx}px`
                }

                // SVGをDataURIに変換 (改行を削除してエンコード)
                const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgString.replace(/\s+/g, ' ').trim())}`

                return {
                    backgroundImage: `url("${svgDataUrl}")`,
                    backgroundSize: bgSize,
                    backgroundPosition: isVertical
                        // 縦書き: 元々のズレ(-halfPad) に adjustmentY を足す (例: -3 + -2 = -5px)
                        ? `right top ${-halfPad + adjustmentY}px`

                        // 横書き: top(0) の位置に adjustmentY を足す (例: -2px)
                        : `left -${halfPad}px top ${adjustmentY}px`,
                    border: `1px solid ${outlineColor}`
                }

            case 'line': // 下線/縦線
                // 色設定 (SVGじゃないので # のままでOK)
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

            case 'outline': // 外枠のみ
                return {
                    backgroundImage: 'none',
                    border: `1px solid ${outlineColor}`
                }

            case 'none': // 設定なし
            default:
                return {
                    backgroundImage: 'none',
                    border: 'none'
                }
        }
    }

    // スタイルを取得
    const backgroundStyle = getGenkoBackground()

    // 原稿エリア（版面）のサイズ計算
    const editorStyle = isVertical
        ? {
            // ■ 縦書き設定
            writingMode: 'vertical-rl' as const,
            height: `${cellSize * gridSettings.chars}px`,
            minWidth: `${lineHeightPx * gridSettings.lines}px`, // width -> minWidthに変更済みの箇所
            letterSpacing: `${cellPadding}px`,

            // ★ここを変更！ 中央寄せをやめて「右寄せ」にする
            // 上:50px, 右:50px, 下:50px, 左:auto (これで右に張り付く)
            margin: '50px 50px 50px auto',

            padding: '0',
            wordBreak: 'break-all' as const,
        }
        : {
            // ■ 横書き設定
            writingMode: 'horizontal-tb' as const,
            width: `${cellSize * gridSettings.chars}px`,
            minHeight: `${lineHeightPx * gridSettings.lines}px`, // height -> minHeightに変更済みの箇所
            letterSpacing: `${cellPadding}px`,
            // 横書きは中央寄せでOK
            margin: '50px auto',

            padding: '0',
            wordBreak: 'break-all' as const,
        }

    const gridBackground = {
        backgroundImage: isVertical
            ? `repeating-linear-gradient(to left, transparent, transparent ${currentFontSize * lineHeightRatio - 1}px, #e0e0e0 ${currentFontSize * lineHeightRatio}px)`
            : `repeating-linear-gradient(to bottom, transparent, transparent ${currentFontSize * lineHeightRatio - 1}px, #e0e0e0 ${currentFontSize * lineHeightRatio}px)`,
        backgroundAttachment: 'local',
    }

    if (!editor) return null

    return (
        <div className="editor-container">
            {/* --- 設定モーダル --- */}
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

            {/* --- メニューバー --- */}
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
                        <div className="dropdown-menu">
                            <button onClick={() => setDirection(false)}>横書き (Horizontal)</button>
                            <button onClick={() => setDirection(true)}>縦書き (Vertical)</button>
                            <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #eee' }} />
                            {/* ★追加: 原稿用紙モード選択 */}
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

            {/* --- ツールバー --- */}
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
                    value={editor.getAttributes('textStyle').fontSize || ''}
                >
                    <option value="" disabled>Size</option>
                    <option value="16">16px (推奨)</option>
                    <option value="12">12px</option>
                    <option value="20">20px</option>
                    <option value="24">24px</option>
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
            <div className="editor-workspace" onClick={closeMenu}>

                {/* 紙 (Paper) */}
                <div className="editor-paper">

                    {/* 版面 (Layout Area) */}
                    <div
                        className="editor-layout-area"
                        style={{
                            ...editorStyle,     // サイズ計算
                            ...backgroundStyle, // ★ここで背景と枠線を適用
                            fontFamily: '"MS Gothic", "Courier New", monospace',
                            lineHeight: lineHeightRatio,
                        }}
                    >
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TiptapEditor