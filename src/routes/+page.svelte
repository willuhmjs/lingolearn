<script lang="ts">
</script>

<svelte:head>
	<title>LernenDeutsch - Master German with AI</title>
	<meta name="description" content="AI-powered German language learning platform" />
</svelte:head>

<section class="hero">
	<h1>Willkommen bei <span class="highlight">LernenDeutsch</span></h1>
	<p class="subtitle">
		Your personal, AI-powered platform to master the German language.
		Engage in personalized lessons, get instant feedback, and track your progress seamlessly.
	</p>
	<div class="actions">
		<a href="/signup" class="btn btn-primary">Get Started</a>
		<a href="/login" class="btn btn-secondary">Login</a>
	</div>
</section>

<section class="features">
	<div class="feature-card">
		<h3>🤖 AI-Powered Lessons</h3>
		<p>Dynamically generated lessons tailored to your skill level and learning pace.</p>
	</div>
	<div class="feature-card">
		<h3>⚡ Instant Feedback</h3>
		<p>Get real-time corrections and explanations from our intelligent grader.</p>
	</div>
	<div class="feature-card">
		<h3>📈 Track Progress</h3>
		<p>Monitor your vocabulary and grammar improvements over time.</p>
	</div>
</section>

<style>
	.hero {
		text-align: center;
		padding: 4rem 1rem;
		max-width: 800px;
		margin: 0 auto;
	}

	h1 {
		font-size: 3rem;
		font-weight: 800;
		color: #111827;
		margin-bottom: 1.5rem;
		line-height: 1.2;
	}

	.highlight {
		color: #2563eb;
	}

	.subtitle {
		font-size: 1.25rem;
		color: #4b5563;
		line-height: 1.6;
		margin-bottom: 2.5rem;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 0.5rem;
		text-decoration: none;
		transition: all 0.2s;
	}

	.btn-primary {
		background-color: #2563eb;
		color: #ffffff;
		border: 1px solid #2563eb;
	}

	.btn-primary:hover {
		background-color: #1d4ed8;
		border-color: #1d4ed8;
	}

	.btn-secondary {
		background-color: var(--card-bg, #ffffff);
		color: var(--text-color, #374151);
		border: 1px solid var(--card-border, #d1d5db);
	}

	.btn-secondary:hover {
		background-color: #f3f4f6;
		border-color: #9ca3af;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
		padding: 2rem 1rem;
		margin-top: 2rem;
	}

	.feature-card {
		background: var(--card-bg, #ffffff);
		padding: 2rem;
		border-radius: 0.75rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		text-align: center;
	}

	.feature-card h3 {
		font-size: 1.25rem;
		color: #111827;
		margin-bottom: 1rem;
	}

	.feature-card p {
		color: #6b7280;
		line-height: 1.5;
	}
</style>
