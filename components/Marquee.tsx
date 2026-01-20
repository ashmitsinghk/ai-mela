'use client';
import { motion } from 'framer-motion';

const Marquee = ({ text, direction = 'left' }: { text: string; direction?: 'left' | 'right' }) => {
    return (
        <div className="bg-black text-white py-3 overflow-hidden border-b-4 border-black w-full">
            <motion.div
                className="flex whitespace-nowrap"
                initial={{ x: direction === 'left' ? '0%' : '-50%' }}
                animate={{
                    x: direction === 'left' ? '-50%' : '0%',
                }}
                transition={{
                    repeat: Infinity,
                    ease: "linear",
                    duration: 20,
                }}
                style={{ width: "fit-content", display: "flex" }}
            >
                {[...Array(20)].map((_, i) => (
                    <span key={i} className="mx-4 font-mono text-xl font-bold uppercase tracking-widest">
                        {text}
                    </span>
                ))}
            </motion.div>
        </div>
    );
};
export default Marquee;
