<template>

  <div class="custom-landing-container">

    <!-- 全屏加载动画 -->

    <div

        v-if="shouldShowPreloader"

        class="preloader"

        :class="{'fade-out': isLoaded}"

        ref="preloader"

        :style="preloaderStyle"

    >

      <div class="loader" :style="loaderStyle"></div>

    </div>






    <!-- iframe用于加载自定义landing页面 -->

    <iframe

        v-if="customLandingPath"

        :src="customLandingPath"

        class="custom-landing-iframe"

        ref="landingIframe"

        frameborder="0"

        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"

        allowfullscreen

        @load="handleIframeLoaded"

    ></iframe>



    <!-- 如果没有授权码或未指定自定义landing页，显示默认landing页 -->

    <div v-else>

      <LandingPage @loaded="handleContentLoaded" />

    </div>

  </div>

</template>



<script>

import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue';

import { useRouter } from 'vue-router';

import { SITE_CONFIG, THEME_CONFIG, DEFAULT_CONFIG } from '@/utils/baseConfig';




import { useTheme } from '@/composables/useTheme';

import DomainAuthAlert from '@/components/common/DomainAuthAlert.vue';

import LandingPage from './LandingPage.vue';



export default {

  name: 'CustomLandingPage',

  components: {

    DomainAuthAlert,

    LandingPage

  },

  setup() {

    const router = useRouter();

    const landingIframe = ref(null);

    const preloader = ref(null);

    const isLoaded = ref(false);



    const { theme, toggleTheme } = useTheme();






    const preloaderStyle = computed(() => {

      const themeColors = THEME_CONFIG[theme.value];

      return {

        backgroundColor: themeColors.backgroundColor

      };

    });



    const loaderStyle = computed(() => {

      const themeColors = THEME_CONFIG[theme.value];

      const primaryColor = themeColors.primaryColor || DEFAULT_CONFIG.primaryColor;

      const primaryRgb = themeColors.primaryColorRgb;



      return {

        '--loader-primary-color': primaryColor,

        '--loader-primary-rgb': primaryRgb,

        '--loader-primary-light': primaryColor,
      };

    });



    const handleIframeMessage = (event) => {

      if (event.data && event.data.type === 'navigation') {

        router.push('/' + event.data.route);

      }

      else if (event.data && event.data.type === 'themeChanged') {

        if (theme.value !== event.data.theme) {

          toggleTheme();

        }

      }

      else if (event.data && event.data.type === 'getTheme') {

        sendThemeToIframe();

      }

    };



    const sendThemeToIframe = () => {

      if (landingIframe.value && landingIframe.value.contentWindow) {

        landingIframe.value.contentWindow.postMessage({

          type: 'setTheme',

          theme: theme.value

        }, '*');

      }

    };



    watch(theme, () => {

      sendThemeToIframe();

    });



    const setupIframeLinks = () => {
      try {
        const iframe = landingIframe.value;
        if (!iframe) return;
        const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        if (!doc) return;

        doc.addEventListener('click', (e) => {
          const a = e.target.closest('a');
          if (!a) return;

          const href = a.getAttribute('href') || '';
          
          // 站内锚点（如 #home, #features, #speed, #pricing, #story）保留在 iframe 内部平滑滚动
          if (href.startsWith('#') && !href.startsWith('#/')) {
            return;
          }

          // 纯外链（如 Telegram 群组等且带有 target="_blank"）允许正常新窗口打开
          if (a.target === '_blank' && !href.includes('/login') && !href.includes('/register') && !href.includes('/dashboard')) {
            return;
          }

          // 拦截前往登录、注册或仪表盘的链接，跳出 iframe，直接更新顶层路由
          if (
            href.includes('/login') ||
            href.includes('/register') ||
            href.includes('/dashboard') ||
            href.includes('xn--9iq350dwjao46n.org') ||
            href.includes('rooftopconcert.1969130.xyz') ||
            href.startsWith('/#') ||
            href.startsWith('#/')
          ) {
            e.preventDefault();
            e.stopPropagation();

            if (href.includes('/register')) {
              router.push('/register');
            } else if (href.includes('/dashboard')) {
              router.push('/dashboard');
            } else {
              router.push('/login');
            }
          }
        }, true);
      } catch (err) {
        console.warn('Iframe setup link error:', err);
      }
    };

    const handleIframeLoaded = () => {
      setupIframeLinks();

      setTimeout(() => {
        hidePreloader();
      }, 500);
    };



    const handleContentLoaded = () => {

      hidePreloader();

    };



    const PRELOADER_KEY = 'ez_preloader_shown';

    const shouldShowPreloader = ref(sessionStorage.getItem(PRELOADER_KEY) !== '1');



    const hidePreloader = () => {

      isLoaded.value = true;

      sessionStorage.setItem(PRELOADER_KEY, '1');

      shouldShowPreloader.value = false;

    };



    onMounted(async () => {

      if (sessionStorage.getItem(PRELOADER_KEY) === '1') {

        isLoaded.value = true;

        if (preloader.value) preloader.value.style.display = 'none';

      }










      window.addEventListener('message', handleIframeMessage);



      if (landingIframe.value) {
        landingIframe.value.onload = () => {
          setupIframeLinks();
          setTimeout(() => {
            sendThemeToIframe();
          }, 500);
        };
      }



      setTimeout(() => {

        if (!isLoaded.value) {

          hidePreloader();

        }

      }, 5000);

    });



    onBeforeUnmount(() => {

      window.removeEventListener('message', handleIframeMessage);

    });



    const customLandingPath = computed(() => {

      if (!SITE_CONFIG.customLandingPage) return '';



      let path = SITE_CONFIG.customLandingPage;



      if (!path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://')) {

        path = '/' + path;

      }



      return path;

    });



    return {


      customLandingPath,

      landingIframe,

      preloader,

      isLoaded,

      handleIframeLoaded,

      handleContentLoaded,

      preloaderStyle,

      loaderStyle,

      shouldShowPreloader

    };

  }

};

</script>



<style lang="scss" scoped>

.custom-landing-container {

  width: 100%;

}



.custom-landing-iframe {

  width: 100%;

  height: 100%;

  border: none;

  position: absolute;

  top: 0;

  left: 0;

}





.preloader {

  position: fixed;

  top: 0;

  left: 0;

  width: 100%;

  height: 100%;

  background-color: var(--background-color);

  display: flex;

  justify-content: center;

  align-items: center;

  z-index: 9999;

  transition: opacity 0.8s ease, visibility 0.8s ease;

}



.preloader.fade-out {

  opacity: 0;

  visibility: hidden;

}



.loader {

  width: 50px;

  height: 50px;

  border-radius: 50%;

  border-top-color: var(--loader-primary-color);

  animation: spin 1s ease-in-out infinite;

  position: relative;

}



.loader::before {

  content: '';

  position: absolute;

  top: -3px;

  left: -3px;

  right: -3px;

  bottom: -3px;

  border: 3px solid transparent;

  border-bottom-color: var(--loader-primary-light);

  border-radius: 50%;

  animation: spin 1.5s linear infinite;

}



@keyframes spin {

  0% {

    transform: rotate(0deg);

  }

  100% {

    transform: rotate(360deg);

  }

}

</style>
