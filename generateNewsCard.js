<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/assets/comicGEN%20favicon-CEC2BfvD.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>ComicGen Student Edition | Historical Chronicle Forge</title>
    <meta name="description" content="Visualise complex history books and dense humanities passages into elegant 3-panel comic strips instantly using AI." />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://esm.run https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://generativelanguage.googleapis.com https://ai.api.nvidia.com;">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Special+Elite&family=Caveat:wght@700&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/student-CKZiwvKq.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/html2canvas.esm-DIa_aVMa.js">
    <link rel="stylesheet" crossorigin href="/assets/student-BHoMz6pP.css">
  </head>
  <body>
    <!-- Full Width Sticky Yellow Header Bar -->
    <header class="comic-header-bar">
      <a href="./index.html" class="btn-back">← BACK TO NEWS HUB</a>
      <div class="header-title">STUDENT EDITION</div>
      <button id="studentAudioToggle" class="btn-audio-toggle playing">🔊 AUDIO ON</button>
    </header>

    <div id="studentApp">
      <main>
        <!-- Welcome Board -->
        <section class="welcome-board">
          <div class="news-header">
            <h1 class="student-page-title">VISUAL STUDY CARD COMPANION</h1>
            <p class="section-subtitle">A creative visualizer built specifically for students to master subjects like history, civics, geography, political science, and humanities. Turn dense textbook readings into 3-panel study cards to download, share, and retain key concepts instantly!</p>
          </div>
        </section>

        <div class="student-workspace">
          <!-- Input Panel styled like an old library index card -->
          <section class="student-input-panel">
            <!-- Notebook Spiral Rings -->
            <div class="notebook-rings">
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
              <div class="ring"></div>
            </div>
            
            <h4 class="input-title"><span>1. CHOOSE ILLUSTRATION STYLE</span></h4>
            
            <div class="style-selector-grid">
              <label class="style-card comic">
                <input type="radio" name="studentStyle" value="typical comic character" checked="checked" />
                <div class="style-card-content">
                  <div class="style-badge">COMIC</div>
                  <div class="style-name">VINTAGE COMIC</div>
                  <div class="style-desc">Bold line-art with halftone vibe</div>
                </div>
              </label>
              
              <label class="style-card anime">
                <input type="radio" name="studentStyle" value="anime" />
                <div class="style-card-content">
                  <div class="style-badge">ANIME</div>
                  <div class="style-name">MANGA SERIES</div>
                  <div class="style-desc">Stylized Japanese visual novel</div>
                </div>
              </label>
              
              <label class="style-card stickman">
                <input type="radio" name="studentStyle" value="stick man characters" />
                <div class="style-card-content">
                  <div class="style-badge">MINIMAL</div>
                  <div class="style-name">STICK ADVENTURE</div>
                  <div class="style-desc">Charming pencil-sketch doodle</div>
                </div>
              </label>
              
              <label class="style-card custom">
                <input type="radio" name="studentStyle" value="graphical design style" />
                <div class="style-card-content">
                  <div class="style-badge">GRAPHIC</div>
                  <div class="style-name">GRAPHICAL STYLE</div>
                  <div class="style-desc">Sleek vector layouts and clean lines</div>
                </div>
              </label>
            </div>

            <h4 class="input-title"><span>2. PASTE BOOK PASSAGE</span></h4>
            <textarea id="studentTextarea" placeholder="PASTE YOUR HISTORY TEXTBOOK PAGES, PASSAGES, OR DENSE PARAGRAPHS HERE (100-500 WORDS FOR BEST RESULTS)..."></textarea>
            
            <div class="action-bar">
              <button id="studentDemoBtn" class="btn-secondary-action">LOAD HISTORY DEMO</button>
              <div class="generate-btn-wrapper">
                <button id="studentGenerateBtn" class="btn-primary-action" aria-label="Forge Chronicle Strip">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                    <path d="M11 21h-1l1-7H4.5c-.3 0-.5-.2-.5-.5 0-.1.1-.3.1-.3l7.5-12.7h1l-1 7H19.5c.3 0 .5.2.5.5 0 .1-.1.2-.2.3L12.3 20.7c-.1.2-.2.3-.3.3z"/>
                  </svg>
                </button>
                <span id="studentGenerateText" class="btn-label-text">FORGE!</span>
              </div>
            </div>
          </section>

          <!-- Scroll Down Indicator (appears after clicking Forge) -->
          <div id="studentScrollIndicator" class="scroll-down-indicator" style="display: none;">
            <button id="studentScrollBtn" class="btn-scroll-down" aria-label="Scroll to output">
              <span>SCROLL TO STUDY CARDS</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
            </button>
          </div>

          <!-- Loading Panel using CMYK spinner -->
          <section id="studentLoadingPanel" class="status-indicator-panel" style="display: none;">
            <div class="status-top-bar">CHRONICLER BRAIN COMPILING</div>
            <div class="status-content">
              <div id="studentStatusText">ANALYZING THE STORYLINE...</div>
              <div class="retro-loader">
                <div class="spinner-inner">
                  <div class="orbiting-ball cyan"></div>
                  <div class="orbiting-ball magenta"></div>
                  <div class="orbiting-ball yellow"></div>
                  <div class="center-star">★</div>
                </div>
              </div>
            </div>
          </section>

          <!-- Output Strip styled like an vintage textbook strip -->
          <section id="studentOutputSection" class="student-output-section" style="display: none;">
            <div id="studentComicCanvas" class="student-comic-canvas">
              <!-- Notebook Spiral Rings -->
              <div class="notebook-rings">
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
                <div class="ring"></div>
              </div>
              
              <!-- Graded Stamp Overlay -->
              <div class="graded-stamp">
                <div class="stamp-stars">★★★★★</div>
                <div class="stamp-text">FORGED A+</div>
                <div class="stamp-sub">STUDENT COMPANION</div>
              </div>
              
              <!-- Handwritten Teacher's Feedback note -->
              <div class="handwritten-feedback">
                <span class="handwritten">Excellent work! 100% Retained. - Mrs. Gable</span>
              </div>

              <div id="studentComicTitle" class="student-comic-title">THE HISTORICAL CHRONICLE</div>
              
              <div class="student-panels-grid">
                <!-- Panel 1 -->
                <div class="student-panel-box" id="panelBox1">
                  <div class="student-panel-img-box" id="studentImg1">
                    <div class="skeleton-img"></div>
                  </div>
                  <div class="student-panel-caption" id="studentCaption1">NARRATIVE PORTION 1...</div>
                </div>

                <!-- Panel 2 -->
                <div class="student-panel-box" id="panelBox2">
                  <div class="student-panel-img-box" id="studentImg2">
                    <div class="skeleton-img"></div>
                  </div>
                  <div class="student-panel-caption" id="studentCaption2">NARRATIVE PORTION 2...</div>
                </div>

                <!-- Panel 3 -->
                <div class="student-panel-box" id="panelBox3">
                  <div class="student-panel-img-box" id="studentImg3">
                    <div class="skeleton-img"></div>
                  </div>
                  <div class="student-panel-caption" id="studentCaption3">NARRATIVE PORTION 3...</div>
                </div>
              </div>

              <!-- Vintage Student Watermark -->
              <div class="comic-watermark-overlay">
                <img src="/assets/comicGEN%20favicon-CEC2BfvD.png" alt="ComicGen Logo" />
                <span>COMICGEN STUDENT</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="final-actions">
              <button id="studentDownloadBtn" class="btn-secondary-action download">DOWNLOAD STUDY CARDS</button>
              <button id="studentShareBtn" class="btn-ghost-action share">SHARE</button>
            </div>
          </section>
        </div>
      </main>

      <footer class="student-footer">
        <p class="footer-copyright">&copy; 2026 COMICGEN STUDENT EDITION - FOR THE BETTERMENT OF ACADEMIC COMPREHENSION.</p>
      </footer>
    </div>

  </body>
</html>
