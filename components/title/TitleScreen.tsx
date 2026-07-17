import Image from 'next/image'
import localFont from 'next/font/local'
import styles from './TitleScreen.module.css'
import { KOREA_SILHOUETTE_PATH, KOREA_VIEWBOX, PROVINCE_LINKS, PROVINCE_NODES } from './korea-outline'
import naerumi from '@/public/images/title/naerumi.png'
import pikachu from '@/public/images/title/pikachu.png'

const blackHanSans = localFont({
  src: './fonts/BlackHanSans-subset.ttf',
  variable: '--font-black-han-sans',
  display: 'swap',
})

function nodeByKey(key: string) {
  const node = PROVINCE_NODES.find((n) => n.key === key)
  if (!node) throw new Error(`unknown province node: ${key}`)
  return node
}

export default function TitleScreen() {
  return (
    <div className={`${styles.stage} ${blackHanSans.variable}`}>
      <div className={styles.stars} />
      <div className={styles.starsBright} />

      <svg className={styles.koreaMap} viewBox={KOREA_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        <path className={styles.koreaFill} d={KOREA_SILHOUETTE_PATH} />

        {PROVINCE_LINKS.map((link) => {
          const from = nodeByKey(link.from)
          const to = nodeByKey(link.to)
          return (
            <line
              key={`${link.from}-${link.to}`}
              className={link.dashed ? styles.dashed : undefined}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          )
        })}

        {PROVINCE_NODES.map((node) => (
          <g key={node.key}>
            {node.hub && <circle className={styles.pulse} cx={node.x} cy={node.y} r={14} />}
            <circle className={node.hub ? styles.hub : styles.node} cx={node.x} cy={node.y} r={node.hub ? 7 : 5} />
          </g>
        ))}

        {PROVINCE_NODES.map((node) => (
          <text
            key={node.key}
            className={node.hub ? styles.hubLabel : undefined}
            x={node.hub ? node.x + 9 : node.x - node.label.length * 6 - 6}
            y={node.y - 6}
          >
            {node.label}
          </text>
        ))}
      </svg>

      <div className={styles.moonDisc} />

      <div className={`${styles.mascot} ${styles.mHero}`}>
        <Image src={naerumi} alt="" priority sizes="30vw" style={{ width: '100%', height: 'auto' }} />
      </div>
      <div className={`${styles.mascot} ${styles.mPikachu}`}>
        <Image src={pikachu} alt="" sizes="14vw" style={{ width: '100%', height: 'auto' }} />
      </div>

      <div className={styles.lockup}>
        <div className={styles.wordmark}>
          POK<span className={styles.accentE}>E</span>MAP
        </div>
        <div className={styles.tagline}>포켓몬과 함께하는 전국팔도 탐험</div>
        <div className={styles.divider} />
        <div className={styles.subtagline}>
          한국을 돌면서 좋아하는 포켓몬을 찾고 도감을 채우자.
          <br />한 지방을 다 탐험한다면, 전설이 나타날지도..
        </div>
      </div>

      <div className={styles.credit}>
        Title Screen · <b>내루미 팀</b> 제작
      </div>

      <div className={styles.grain} />
      <div className={styles.vignette} />
      <div className={styles.frameBorder} />
      <div className={`${styles.corner} ${styles.cornerTl}`} />
      <div className={`${styles.corner} ${styles.cornerTr}`} />
      <div className={`${styles.corner} ${styles.cornerBl}`} />
      <div className={`${styles.corner} ${styles.cornerBr}`} />
    </div>
  )
}
