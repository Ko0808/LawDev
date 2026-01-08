// src/components/TiptapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
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

    // エディタ設定
    const editor = useEditor({
        extensions: [StarterKit, TextStyle, FontFamily, FontSize],
        content: '<p>ここに入力してください...</p>',
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
    const lineHeightRatio = 1.75

    // 原稿エリア（版面）のサイズ計算
    const editorStyle = isVertical
        ? {
            // ■ 縦書き設定
            writingMode: 'vertical-rl' as const,
            height: `${currentFontSize * gridSettings.chars}px`,
            width: `${currentFontSize * lineHeightRatio * gridSettings.lines}px`,

            // ★ここを変更！ 中央寄せをやめて「右寄せ」にする
            // 上:50px, 右:50px, 下:50px, 左:auto (これで右に張り付く)
            margin: '50px 50px 50px auto',

            padding: '0',
            wordBreak: 'break-all' as const,
        }
        : {
            // ■ 横書き設定
            writingMode: 'horizontal-tb' as const,
            width: `${currentFontSize * gridSettings.chars}px`,
            minHeight: `${currentFontSize * lineHeightRatio * gridSettings.lines}px`,

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
                            ...editorStyle,    // 版面のサイズと配置
                            ...gridBackground, // グリッド線
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