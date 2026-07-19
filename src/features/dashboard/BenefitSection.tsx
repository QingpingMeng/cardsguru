import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardArt } from '@/components/CardArt';
import type { BenefitSection as Section } from '@/lib/benefits';
import { springSoft } from '@/lib/motion';
import { BenefitCard } from './BenefitCard';

export function BenefitSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  const { card, catalogCard } = section;

  return (
    <section className="benefit-section">
      <button
        type="button"
        className="section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`section-toggle__chevron${open ? ' is-open' : ''}`} aria-hidden>
          ›
        </span>
        {card && catalogCard && (
          <CardArt
            size="sm"
            name={catalogCard.name}
            artRef={catalogCard.artRef}
            imageUrl={catalogCard.imageUrl}
            last4={card.last4}
          />
        )}
        <span className="section-toggle__title">{section.title}</span>
        {section.subtitle && <span className="section-toggle__subtitle">{section.subtitle}</span>}
        <span className="section-toggle__count" aria-label={`${section.items.length} benefits`}>
          {section.items.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            style={{ overflow: 'hidden' }}
          >
            <div className="card-grid benefit-section__grid">
              {section.items.map((d) => (
                <BenefitCard key={`${d.card.userCardId}:${d.benefit.id}`} d={d} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
