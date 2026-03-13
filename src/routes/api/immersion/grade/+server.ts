import { json } from '@sveltejs/kit';
import { generateChatCompletion } from '$lib/server/llm';
import { updateGamification } from '$lib/server/gamification';
import { isClearlyCorrect } from '$lib/server/fuzzyGrade';
import { prisma } from '$lib/server/prisma';

/** Track a correct answer against an assignment score record for immerse mode. */
async function updateAssignmentScore(assignmentId: string, userId: string, correctCount: number) {
	const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
	if (!assignment) return null;

	// Verify the user is a member of the assignment's class
	const member = await prisma.classMember.findUnique({
		where: { classId_userId: { classId: assignment.classId, userId } }
	});
	if (!member) return null;

	const current = await prisma.assignmentScore.findUnique({
		where: { assignmentId_userId: { assignmentId, userId } }
	});

	const newScore = (current?.score ?? 0) + correctCount;
	const passed = newScore >= assignment.targetScore;

	const updated = await prisma.assignmentScore.upsert({
		where: { assignmentId_userId: { assignmentId, userId } },
		create: { assignmentId, userId, score: newScore, passed },
		update: { score: newScore, passed }
	});

	return { score: updated.score, targetScore: assignment.targetScore, passed: updated.passed };
}

export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { question, userAnswer, sampleAnswer, awardXp, directXp, assignmentId, correctCount } = await request.json();

		// directXp: skip LLM grading, just award this XP amount directly (used for MCQ batches)
		if (typeof directXp === 'number' && (directXp > 0 || assignmentId)) {
			if (!assignmentId) {
				await updateGamification(locals.user.id, directXp);
			}
			// Update assignment score for MCQ batch if in assignment context
			let assignmentProgress = null;
			if (assignmentId && typeof correctCount === 'number' && correctCount > 0) {
				assignmentProgress = await updateAssignmentScore(assignmentId, locals.user.id, correctCount);
			}
			return json({ score: 1, feedback: '', assignmentProgress });
		}

		if (!userAnswer?.trim()) {
			return json({ score: 0, feedback: 'No answer provided.' });
		}

		// Fast path: skip LLM if fuzzy matching is confident the answer is correct
		if (sampleAnswer && isClearlyCorrect(userAnswer, sampleAnswer)) {
			if (!assignmentId && awardXp && typeof awardXp === 'number') {
				await updateGamification(locals.user.id, awardXp);
			}
			let assignmentProgress = null;
			if (assignmentId) {
				assignmentProgress = await updateAssignmentScore(assignmentId, locals.user.id, 1);
			}
			return json({ score: 1, feedback: '', assignmentProgress });
		}

		const systemPrompt = `You are grading a reading comprehension answer for a language learning app.
The student read an authentic text in their target language and answered a question in English.
Output ONLY valid JSON: {"score": number, "feedback": string}
- score: 0.0 to 1.0 (1.0 = complete and accurate, 0.7 = mostly correct, 0.4 = partially correct, 0.0 = wrong/irrelevant)
- feedback: 1-2 sentences of constructive feedback in English. Mention what was good and what was missing if score < 1.0.
Be lenient with phrasing as long as the core meaning is correct. Accept synonyms and paraphrases.`;

		const userMessage = `Question: ${question}
Sample answer: ${sampleAnswer}
Student's answer: ${userAnswer}`;

		const response = await generateChatCompletion({
			userId: locals.user.id,
			messages: [{ role: 'user', content: userMessage }],
			systemPrompt,
			jsonMode: true,
			temperature: 0.1
		});

		const result = JSON.parse(response.choices[0].message.content);
		const score = typeof result.score === 'number' ? Math.max(0, Math.min(1, result.score)) : 0;

		// Award XP proportional to score (skip XP for assignments)
		if (!assignmentId && awardXp && typeof awardXp === 'number' && score > 0) {
			const xpEarned = Math.round(awardXp * score);
			if (xpEarned > 0) {
				await updateGamification(locals.user.id, xpEarned);
			}
		}

		// Track assignment score: count as correct if score >= 0.5
		let assignmentProgress = null;
		if (assignmentId && score >= 0.5) {
			assignmentProgress = await updateAssignmentScore(assignmentId, locals.user.id, 1);
		}

		return json({ score, feedback: result.feedback || '', assignmentProgress });
	} catch (error) {
		console.error('Immersion grade error:', error);
		return json({ score: 0, feedback: 'Could not grade your answer. Please try again.' });
	}
}
