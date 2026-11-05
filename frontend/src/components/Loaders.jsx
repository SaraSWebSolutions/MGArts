/** Skeleton (shimmer) loaders used while data is loading. Styles live in index.css */

export function Skeleton({ width = "100%", height = 12, style }) {
  return <span className="skel" style={{ width, height, ...style }} />;
}

/** placeholder rows for a table body */
export function SkeletonRows({ cols = 5, rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} className="skel-row" aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}>
          <Skeleton width={c === 0 ? "72%" : `${42 + ((i + c) % 4) * 12}%`} />
        </td>
      ))}
    </tr>
  ));
}

/** placeholder for a whole page: heading, stat cards, then panels or a form card */
export function PageSkeleton({ cards = 3, panels = 0, lines = 0 }) {
  return (
    <div className="master-page" aria-busy="true" aria-label="Loading">
      <div className="skel-head">
        <Skeleton width={130} height={11} />
        <Skeleton width={270} height={30} style={{ marginTop: 12 }} />
        <Skeleton width="52%" height={13} style={{ marginTop: 14 }} />
      </div>
      {cards > 0 && (
        <div className="skel-cards">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="skel-card">
              <Skeleton width="42%" height={12} />
              <Skeleton width="66%" height={26} style={{ marginTop: 14 }} />
              <Skeleton width="50%" height={10} style={{ marginTop: 14 }} />
            </div>
          ))}
        </div>
      )}
      {panels > 0 && (
        <div className="skel-panels">
          {Array.from({ length: panels }, (_, i) => (
            <div key={i} className="skel-card" style={{ minHeight: 230 }}>
              <Skeleton width="38%" height={14} />
              {Array.from({ length: 5 }, (_, n) => (
                <Skeleton
                  key={n}
                  width={`${92 - n * 11}%`}
                  height={12}
                  style={{ marginTop: 20 }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {lines > 0 && (
        <div className="skel-card">
          {Array.from({ length: lines }, (_, n) => (
            <Skeleton
              key={n}
              width={`${96 - (n % 3) * 14}%`}
              height={14}
              style={{ marginTop: n ? 22 : 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** shown while the signed-in user is being checked */
export function FullPageLoader() {
  return (
    <div className="skel-fullpage" aria-busy="true" aria-label="Loading">
      <div className="skel-card">
        <Skeleton width="46%" height={22} />
        {[100, 84, 92, 60].map((w, i) => (
          <Skeleton key={i} width={`${w}%`} height={12} style={{ marginTop: 20 }} />
        ))}
      </div>
    </div>
  );
}

/** placeholder for a form / key-value block while only its own response is loading */
export function BlockSkeleton({ lines = 5, style }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={style}>
      {Array.from({ length: lines }, (_, n) => (
        <Skeleton
          key={n}
          width={`${96 - (n % 3) * 16}%`}
          height={14}
          style={{ marginTop: n ? 22 : 0 }}
        />
      ))}
    </div>
  );
}
