interface PageMetaProps {
  title: string;
  description: string;
  path?: string;
  indexable?: boolean;
}

const SITE = "Leash";
const ORIGIN = "https://leash-api.onrender.com";

export function PageMeta({ title, description, path, indexable = true }: PageMetaProps) {
  const fullTitle = path === "/" ? `${SITE}: ${title}` : `${title} | ${SITE}`;
  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={indexable ? "index, follow" : "noindex, nofollow"} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {path ? <link rel="canonical" href={`${ORIGIN}${path}`} /> : null}
    </>
  );
}
