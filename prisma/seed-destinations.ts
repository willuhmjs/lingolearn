/**
 * One-shot script to seed ImmersionDestination rows.
 * Run with: npx tsx prisma/seed-destinations.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
	const [de, es, fr] = await Promise.all([
		prisma.language.findUnique({ where: { code: 'de' } }),
		prisma.language.findUnique({ where: { code: 'es' } }),
		prisma.language.findUnique({ where: { code: 'fr' } })
	]);
	if (!de || !es || !fr) {
		console.error('Languages not found — run the main seed first.');
		process.exit(1);
	}

	const existing = await prisma.immersionDestination.count();
	if (existing > 0) {
		console.log(`Destinations already seeded (${existing} rows). Skipping.`);
		return;
	}

	const result = await prisma.immersionDestination.createMany({
		data: [
			// German-speaking world
			{ languageId: de.id, city: 'Berlin', country: 'Germany', emoji: '🇩🇪', description: "Germany's vibrant, history-rich capital" },
			{ languageId: de.id, city: 'Munich', country: 'Germany', emoji: '🇩🇪', description: "Bavaria's beer gardens and Alpine backdrop" },
			{ languageId: de.id, city: 'Hamburg', country: 'Germany', emoji: '🇩🇪', description: "Germany's gateway to the sea" },
			{ languageId: de.id, city: 'Vienna', country: 'Austria', emoji: '🇦🇹', description: 'Imperial palaces, coffee houses, and classical music' },
			{ languageId: de.id, city: 'Salzburg', country: 'Austria', emoji: '🇦🇹', description: "Mozart's birthplace in the Austrian Alps" },
			{ languageId: de.id, city: 'Zurich', country: 'Switzerland', emoji: '🇨🇭', description: "Switzerland's cosmopolitan financial hub" },
			{ languageId: de.id, city: 'Bern', country: 'Switzerland', emoji: '🇨🇭', description: 'Charming medieval arcades and the Swiss capital' },
			{ languageId: de.id, city: 'Cologne', country: 'Germany', emoji: '🇩🇪', description: 'Cathedral city on the Rhine with legendary Karneval' },
			{ languageId: de.id, city: 'Frankfurt', country: 'Germany', emoji: '🇩🇪', description: "Europe's financial heartbeat and Goethe's hometown" },
			{ languageId: de.id, city: 'Dresden', country: 'Germany', emoji: '🇩🇪', description: 'Baroque masterpieces on the banks of the Elbe' },
			// Spanish-speaking world
			{ languageId: es.id, city: 'Madrid', country: 'Spain', emoji: '🇪🇸', description: 'Vibrant capital of flamenco, tapas, and football' },
			{ languageId: es.id, city: 'Barcelona', country: 'Spain', emoji: '🇪🇸', description: "Gaudi's city of art, beaches, and Catalan culture" },
			{ languageId: es.id, city: 'Mexico City', country: 'Mexico', emoji: '🇲🇽', description: 'Ancient Aztec heart meets modern Latin metropolis' },
			{ languageId: es.id, city: 'Buenos Aires', country: 'Argentina', emoji: '🇦🇷', description: 'The Paris of South America — tango and steak capital' },
			{ languageId: es.id, city: 'Bogota', country: 'Colombia', emoji: '🇨🇴', description: 'High-altitude city of emeralds and magical realism' },
			{ languageId: es.id, city: 'Lima', country: 'Peru', emoji: '🇵🇪', description: "South America's culinary capital by the Pacific" },
			{ languageId: es.id, city: 'Havana', country: 'Cuba', emoji: '🇨🇺', description: 'Classic cars, salsa rhythms, and colorful colonial streets' },
			{ languageId: es.id, city: 'Santiago', country: 'Chile', emoji: '🇨🇱', description: "Andean peaks frame Chile's modern, dynamic capital" },
			{ languageId: es.id, city: 'Seville', country: 'Spain', emoji: '🇪🇸', description: "Flamenco's birthplace amid orange trees and tapas bars" },
			{ languageId: es.id, city: 'Cartagena', country: 'Colombia', emoji: '🇨🇴', description: 'Walled Caribbean gem of cobblestones and bougainvillea' },
			// French-speaking world
			{ languageId: fr.id, city: 'Paris', country: 'France', emoji: '🇫🇷', description: 'The City of Light — fashion, cuisine, and the Eiffel Tower' },
			{ languageId: fr.id, city: 'Lyon', country: 'France', emoji: '🇫🇷', description: "France's gastronomic capital and UNESCO heritage city" },
			{ languageId: fr.id, city: 'Marseille', country: 'France', emoji: '🇫🇷', description: 'Sun-drenched port city of bouillabaisse and calanques' },
			{ languageId: fr.id, city: 'Montreal', country: 'Canada', emoji: '🇨🇦', description: "North America's French heart — festivals and poutine" },
			{ languageId: fr.id, city: 'Quebec City', country: 'Canada', emoji: '🇨🇦', description: 'Fortified old town with a distinctly European feel' },
			{ languageId: fr.id, city: 'Brussels', country: 'Belgium', emoji: '🇧🇪', description: "Chocolate, waffles, and the EU's administrative capital" },
			{ languageId: fr.id, city: 'Geneva', country: 'Switzerland', emoji: '🇨🇭', description: 'International diplomacy on the shores of Lake Leman' },
			{ languageId: fr.id, city: 'Dakar', country: 'Senegal', emoji: '🇸🇳', description: "West Africa's vibrant gateway to the Francophone world" },
			{ languageId: fr.id, city: 'Abidjan', country: "Cote d'Ivoire", emoji: '🇨🇮', description: "Cote d'Ivoire's dynamic economic powerhouse" },
			{ languageId: fr.id, city: 'Casablanca', country: 'Morocco', emoji: '🇲🇦', description: 'Atlantic port city where French and Arabic cultures meet' }
		]
	});

	console.log(`Seeded ${result.count} immersion destinations.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
