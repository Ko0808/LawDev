// src/components/TiptapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { FontSize } from './FontSize'
import { useState } from 'react'
import './EditorStyles.css'

const TiptapEditor = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [, forceUpdate] = useState(0)
    const [currentPath, setCurrentPath] = useState<string | null>(null)

    const editor = useEditor({
        extensions: [StarterKit, TextStyle, FontFamily, FontSize],
        content: '<p>ここに入力してください...</p>',
        onTransaction: () => forceUpdate((n) => n + 1),
    })

    // ■ 上書き保存（パスがあれば上書き、なければダイアログ）
    const handleSave = async () => {
        if (!editor) return
        const content = JSON.stringify(editor.getJSON())
        setIsMenuOpen(false)

        // @ts-ignore
        // 第2引数に currentPath を渡すのがポイント！
        // nullなら「名前を付けて保存」扱いになり、パスが入っていれば「上書き」になる
        const result = await window.api.saveFile(content, currentPath)

        if (result.success) {
            // 保存に成功したら、そのパスを記憶更新する（新規保存などの場合のため）
            setCurrentPath(result.filePath)
            alert('保存しました')
        } else if (result.error) {
            alert('エラー: ' + result.error)
        }
    }

    // ■ 名前を付けて保存（強制的にダイアログを出す）
    const handleSaveAs = async () => {
        if (!editor) return
        const content = JSON.stringify(editor.getJSON())
        setIsMenuOpen(false)

        // @ts-ignore
        // 第2引数をあえて渡さない（undefined）ことで、強制的にダイアログを出させる
        const result = await window.api.saveFile(content)

        if (result.success) {
            setCurrentPath(result.filePath) // 新しい名前を記憶
            alert('別名で保存しました')
        }
    }

    // ■ 開く
    const handleOpen = async () => {
        setIsMenuOpen(false)
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
                // ★ここで開いたファイルのパスを記憶する！
                setCurrentPath(result.filePath)
            } catch (e) {
                alert('ファイル破損')
            }
        }
    }

    const handlePrint = () => {
        setIsMenuOpen(false)
        window.print()
    }

    if (!editor) return null

    return (
        <div className="editor-container">
            {/* --- メニューバー --- */}
            <div className="menu-bar">
                <div className="menu-item">
                    <button className="menu-trigger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        File
                    </button>
                    {isMenuOpen && (
                        <div className="dropdown-menu">
                            <button onClick={handleOpen}>Open...</button>
                            {/* Save は handleSave */}
                            <button onClick={handleSave}>Save</button>
                            {/* Save As... は handleSaveAs */}
                            <button onClick={handleSaveAs}>Save As...</button>
                            <button onClick={handlePrint}>Print</button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- ツールバー --- */}
            <div className="toolbar" style={{ flexWrap: 'wrap' }}>
                <select
                    className="toolbar-select"
                    onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                    value={editor.getAttributes('textStyle').fontFamily || ''}
                >
                    <option value="" disabled>Font</option>
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                </select>

                <select
                    className="toolbar-select"
                    onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                    value={editor.getAttributes('textStyle').fontSize || ''}
                >
                    <option value="" disabled>Size</option>
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16">16px</option>
                    <option value="18">18px</option>
                    <option value="20">20px</option>
                    <option value="24">24px</option>
                    <option value="30">30px</option>
                </select>

                <div className="divider" style={{ width: '1px', background: '#ccc', margin: '0 10px' }}></div>

                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    style={{ fontWeight: 'bold' }}
                >
                    B
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                >
                    H1
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                >
                    List
                </button>
            </div>

            <div className="editor-content-wrapper" onClick={() => setIsMenuOpen(false)}>
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}

export default TiptapEditor