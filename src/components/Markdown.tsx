import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Rendu markdown sûr (pas d'HTML brut) avec support GFM (tableaux, listes de tâches, ~barré~). */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // liens : ouverts à l'extérieur (géré par Electron)
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
