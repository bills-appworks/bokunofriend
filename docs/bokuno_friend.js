/**
 * @fileoverview 「けものフレンズ」アニメエンディング風画像ジェネレータ
 * @author twitter:@billstw
 * 
 * Copyright (c) 2017 bills-appworks
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */

/**
 * 定義ファイル(JSON形式)・ファイルパス
 */
var JSON_FILE = 'bokuno_friend.json';

$(function() {
  /**
   * 定義ファイル(JSON形式)読込正常完了後に各種処理を定義・実行
   */
  $.ajax({type: 'GET', url: JSON_FILE}).then(function(g) {

    //// メソッド定義

    /**
     * グレースケール処理
     * @param {Array.<number>} data 画像RGBA値の配列（左上→右下をリニア）
     * @param {number} indexR 処理対象インデックス(R)
     * @param {number} indexG 処理対象インデックス(G)
     * @param {number} indexB 処理対象インデックス(B)
     */
    function processGrayScale(data, indexR, indexG, indexB) {
      // RGBの平均値をRGBに同値指定（グレースケール）
      var average = (data[indexR] + data[indexG] + data[indexB]) / 3;
      data[indexR] = average;
      data[indexG] = average;
      data[indexB] = average;
    }

    /**
     * フレンズ画像をフィルタ処理（輪郭抽出）
     *     正式なアルゴリズムでは無く、高速化のために疑似的に処理
     *     エンボス+塗りつぶし部分透明化+疑似エッジグレースケール+半透明
     * @param {Array.<number>} data 画像RGBA値の配列（左上→右下をリニア）
     * @param {number} original_width オリジナル横ピクセル数
     * @param {number} original_height オリジナル縦ピクセル数
     */
    function filteringFriend(data, original_width, original_height) {
      /**
       * Alpha Channel処理
       * @param {Array.<number>} data 画像RGBA値の配列（左上→右下をリニア）
       * @param {number} i 処理対象インデックス
       */
      function processAlpha(data, i) {
        // RGB全てが塗りつぶし値か否かを判定
        if ((data[i - 3] == g.filter.friend_plain_value) && (data[i - 2] == g.filter.friend_plain_value) && (data[i - 1] == g.filter.friend_plain_value)) {
          // RGB全てが塗りつぶし値ならば透明化
          data[i] = 0;
        } else {
          // 疑似エッジと見なしてグレースケール
          processGrayScale(data, i - 3, i - 2, i - 1);
          // 非透明色を半透明化（透明度はコンフィグパラメタで調整）
          data[i] = 255 - 255 * $(g.id.config.friend_transparency).get(0).valueAsNumber / 100;
        }
      }

      // 近似色と見なすRGB値の差の範囲を定義から取得
      var config_approximate = $(g.id.config.friend_approximate).get(0).valueAsNumber;
      // フィルタ処理対象の横ピクセル数をオリジナル画像横ピクセル数とする
      var filter_width = original_width;
      // 各ピクセルRGBAを走査してフィルタ処理
      for (var i = 0 ; i < data.length ; i ++) {
        // 最下行か否かを判定
        if (i < data.length - filter_width * 4) {
          // 最下行以外
          // RGBかAlphaかを判定
          if ((i + 1) % 4 !== 0) {
            // RGB値
            // 行末尾（画像最右端）か否かを判定
            if ((i + 4) % (filter_width * 4) == 0) {
              // 行末尾なら直前のピクセルと同一RGBA値にして次のピクセル（次行）へ
              data[i    ] = data[i - 4];
              data[i + 1] = data[i - 3];
              data[i + 2] = data[i - 2];
              data[i + 3] = data[i - 1];
              i += 3; // forループでさらに+1
            } else {
              // 行末尾以外
              // 右・下のピクセルのRGB値が近似色と見なせる範囲かを判定
              var diff1 = Math.abs(data[i + 4] - data[i]);
              var diff2 = Math.abs(data[i + filter_width * 4] - data[i]);
              if ((diff1 <= config_approximate) && (diff2 <= config_approximate)) {
                // 右・下ピクセルと近似色（エッジ以外）→塗りつぶし値に設定
                // R/G/Bとも塗りつぶし値であればAlpha値処理時に透明化
                data[i] = g.filter.friend_plain_value;
              } else {
                // 右・下ピクセルと近似色でない（疑似エッジ）
                // 塗りつぶし値+(RGB値×2)-右ピクセルRGB値-下ピクセルRGB値
                data[i] = g.filter.friend_plain_value
                        + 2 * data[i]
                        - data[i + 4]
                        - data[i + filter_width * 4];
              }
            }
          } else {
            // Alpha Channel
            processAlpha(data, i);
          }
        } else {
          // 最下行
          // RGBかAlpha Channelかを判定
          if ((i + 1) % 4 !== 0) {
            // RGB
            // 上ピクセルと同じRGB値にする
            data[i] = data[i - filter_width * 4];
          } else {
            // Alpha Channel
            processAlpha(data, i);
          }
        }
      }
    }

    /**
     * 背景画像をフィルタ処理（グレースケール化）
     * @param {Array.<number>} data 画像RGBA値の配列（左上→右下をリニア）
     * @param {number} original_width オリジナル横ピクセル数
     * @param {number} original_height オリジナル縦ピクセル数
     */
    function filteringBackground(data, original_width, original_height) {
      // RGBAの4要素ずつ処理
      for (var i = 0 ; i < data.length - 4 ; i += 4) {
        // グレースケール
        processGrayScale(data, i, i + 1, i + 2);
      }
    }

    /**
     * 画像ファイルが指定されているか否かを検出
     * @param {string} image_type 画像種別（フレンズ/背景）
     * @return {boolean} true:画像指定済/false:画像指定未
     */ 
    function isImageSpecified(image_type) {
      // 画像要素jQueryオブジェクトに格納されているオリジナル画像情報の有無
      return $('#' + image_type + g.id.image.suffix_original_thumbnail).data(g.id.data.original_image);
    }

    /**
     * 範囲設定調整UI初期化
     * @param {string} config_id 調整UI要素ID
     * @param {number} min_value 最小値
     * @param {number} max_value 最大値
     * @param {number} step_value 調整刻み幅
     * @param {number} default_value デフォルト値
     */
    function initializeRangeConfig(config_id, min_value, max_value, step_value, default_value) {
      var config = $(config_id)
      config.attr('min', min_value);
      config.attr('max', max_value);
      config.attr('step', step_value);
      config.val(default_value);
      // 数値表示
      $(config_id + g.id.config.suffix_numeric).text(default_value);
    }

    /**
     * 画像指定前の画像表示領域上の説明文字列描画
     * @param {string} image_type 画像種別（フレンズ/背景）
     */
    function drawImageDescription(image_type) {
      // 画像指定状態取得
      var is_friend_specified = isImageSpecified(g.image.type.friend);
      var is_background_specified = isImageSpecified(g.image.type.background);
      // 描画テキスト取得
      var executable, text1, text2, text3, canvas;
      switch(image_type) {
      case g.image.type.friend:
        // フレンド画像
        // 描画実行条件：フレンド画像が指定されていない
        executable = !is_friend_specified;
        text1 = g.message.image_description.friend_line1;
        text2 = g.message.image_description.original_line2;
        text3 = g.message.image_description.original_line3;
        canvas = $('#' + image_type + g.id.image.suffix_original_thumbnail);
        break;

      case g.image.type.background:
        // 背景画像
        // 描画実行条件：背景画像が指定されていない
        executable = !is_background_specified;
        text1 = g.message.image_description.background_line1;
        text2 = g.message.image_description.original_line2;
        text3 = g.message.image_description.original_line3;
        canvas = $('#' + image_type + g.id.image.suffix_original_thumbnail);
        break;

      case g.image.type.composite:
        // 合成画像
        // 描画実行条件：フレンド画像も背景画像も一つも指定されていない
        executable = !is_friend_specified && !is_background_specified;
        text1 = g.message.image_description.composite_line1;
        text2 = g.message.image_description.composite_line2;
        text3 = g.message.image_description.composite_line3;
        canvas = $(g.id.image.composite_canvas);
        break;
      }

      // 描画実行条件が成立している場合のみ描画
      if (executable) {
        // ビューサイズとサーフェイスサイズを同期（等倍）
        var width = parseInt(canvas.css('width'));
        var height = width * 9 / 16;
        canvas.attr('width', width);
        canvas.attr('height', height);
        var context = canvas.get(0).getContext('2d');
        // テキスト描画
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = g.message.image_description.fill_style;
        context.shadowColor = 'rgba(0, 0, 0, 0.8)';
        context.shadowOffsetX = 3;
        context.shadowOffsetY = 3;
        context.shadowBlur = 5;
        context.font = g.message.image_description.font_style + ' ' + g.message.image_description.font_family;
        var position_x = width / 2;
        var position_y = height / 4;
        context.fillText(text1, position_x, position_y, width);
        position_y = height / 2;
        context.fillText(text2, position_x, position_y, width);
        position_y = height / 4 * 3;
        context.fillText(text3, position_x, position_y, width);
      }
    }

    /**
     * 合成前画像ファイル指定状態に対応したUI調整
     */
    function linkageUI() {
      // 画像指定状態取得
      var is_background_specified = isImageSpecified(g.image.type.background);
      var is_friend_specified = isImageSpecified(g.image.type.friend);

      // 背景画像指定が無いと無効化
      var condition = !is_background_specified;
      // 背景画像解除ボタン
      $(g.id.image.background_off).prop('disabled', condition);
      // 背景画像無指定時説明文字列
      drawImageDescription(g.image.type.background);

      // フレンズ画像指定が無いと無効化
      condition = !is_friend_specified;
      // フレンズ画像解除ボタン
      $(g.id.image.friend_off).prop('disabled', condition);
      // フレンズ画像透明度調整パラメタUI
      $(g.id.config.friend_transparency).prop('disabled', condition);
      $(g.id.config.friend_transparency).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      // フレンズ画像近似色統合調整パラメタUI
      $(g.id.config.friend_approximate).prop('disabled', condition);
      $(g.id.config.friend_approximate).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      // フィルタ処理前フレンズ画像表示UI
      $(g.id.image.composite_original_friend).prop('disabled', condition);
      $(g.id.image.composite_original_friend).toggleClass(g.class.ui.button_disable, condition);
      // フレンズ画像無指定時説明文字列
      drawImageDescription(g.image.type.friend);

      // フレンズ画像と背景画像と二つ指定が無いと無効化
      condition =  !is_friend_specified || !is_background_specified;
      // フレンズ画像拡大縮小調整パラメタUI
      $(g.id.config.friend_zoom).prop('disabled', condition);
      $(g.id.config.friend_zoom).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      // フレンズ画像位置調整パラメタUI
      $(g.id.config.friend_position_x).prop('disabled', condition);
      $(g.id.config.friend_position_x).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      $(g.id.config.friend_position_y).prop('disabled', condition);
      $(g.id.config.friend_position_y).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      $(g.id.config.friend_position_left).prop('disabled', condition);
      $(g.id.config.friend_position_right).prop('disabled', condition);
      $(g.id.config.friend_position_top).prop('disabled', condition);
      $(g.id.config.friend_position_bottom).prop('disabled', condition);

      // フレンズ画像と背景画像一つも指定が無いと無効化
      condition = !is_friend_specified && !is_background_specified;
      // 合成画像拡大縮小調整パラメタUI
      $(g.id.image.composite_zoom).prop('disabled', condition);
      $(g.id.image.composite_zoom).closest('div').children('span').toggleClass(g.class.ui.text_disable, condition);
      // 合成画像保存UI
      $(g.id.image.composite_saveas).prop('disabled', condition);
      // 合成画像ポップアップ表示UI
      $(g.id.image.composite_popup).prop('disabled', condition);

      // 合成画像非表示時説明文字列
      drawImageDescription(g.image.type.composite);
    }

    /**
     * 合成前画像フィルタ処理（フレンズ/背景画像共通）
     * @param {string} image_type 画像種別（フレンズ/背景）
     */
    function filteringProcess(image_type) {
      // 対象画像ファイルが指定されている場合のみ処理
      if (isImageSpecified(image_type)) {
        // 合成前画像サムネイル
        var original_thumbnail_image = $('#' + image_type + g.id.image.suffix_original_thumbnail);
        // 合成前画像（サムネイル化前）
        var original_image = original_thumbnail_image.data(g.id.data.original_image);
        // フィルタ適用作業領域
        var off_screen_canvas = $('#' + image_type + g.id.image.suffix_off_screen);
        // 縦横サイズを画像ファイルに合わせる
        off_screen_canvas.attr('width', original_image.width);
        off_screen_canvas.attr('height', original_image.height);
        // 画像をcanvasイメージデータに変換
        var off_screen_canvas_context = off_screen_canvas[0].getContext('2d');
        off_screen_canvas_context.drawImage(original_image, 0, 0, original_image.width, original_image.height);
        var image_data = off_screen_canvas_context.getImageData(0, 0, original_image.width, original_image.height);
        var data = image_data.data;
        // 画像種別に対応する個別フィルタ処理を実行
        var filtering_function;
        switch(image_type) {
        case g.image.type.friend:
          filtering_function = filteringFriend;
          break;

        case g.image.type.background:
          filtering_function = filteringBackground;
          break;
        }
        filtering_function(data, original_image.width, original_image.height);
        // フィルタ処理適用後のイメージデータをcanvasに設定
        off_screen_canvas_context.putImageData(image_data, 0, 0);
        // 背景画像とフレンズ画像の両方が指定されている場合の調整UI値設定
        if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
          // 合成画像サイズ取得
          var size = getCompositeSize();

          // フレンズ横位置調整UI設定
          var config = g.config.friend_position_x;
          // 現時点での設定値を取得
          var current_value = $(g.id.config.friend_position_x).get(0).valueAsNumber;
          // フレンズ横位置調整範囲設定
          // 最小値: 背景画像左端からさらにフレンズ画像幅分左（はみ出し指定可能化）
          // 最大値: 背景画像右端（はみ出し指定可能化）
          initializeRangeConfig(g.id.config.friend_position_x, config.min - size.friend_width, size.background_width, config.step, current_value);

          // フレンズ縦位置調整UI設定
          config = g.config.friend_position_y;
          // 現時点での設定値を取得
          current_value = $(g.id.config.friend_position_y).get(0).valueAsNumber;
          // フレンズ縦位置調整範囲設定
          // 最小値: 背景画像上端からさらにフレンズ画像高さ分上（はみ出し指定可能化）
          // 最大値: 背景画像下端（はみ出し指定可能化）
          initializeRangeConfig(g.id.config.friend_position_y, config.min - size.friend_height, size.background_height, config.step, current_value);
        }
        // 画像設定状況に応じて調整UI状態設定
        linkageUI();
      }
    }

    /**
     * 合成画像サイズ取得
     * @return {Object.<string, number>} 背景画像縦横サイズ/フレンズ画像縦横サイズ
     *     'background_width': 背景画像横サイズ
     *     'background_height': 背景画像縦サイズ
     *     'friend_width': フレンズ画像横サイズ
     *     'friend_height': フレンズ画像縦サイズ
     */
    function getCompositeSize() {
      // フィルタ適用canvasの縦横サイズ取得（背景）
      var off_screen_canvas_background = $('#' + g.image.type.background + g.id.image.suffix_off_screen);
      var background_width = off_screen_canvas_background.prop('width');
      var background_height = off_screen_canvas_background.prop('height');
      // フィルタ適用canvasの縦横サイズ取得（フレンズ）
      var off_screen_canvas_friend = $('#' + g.image.type.friend + g.id.image.suffix_off_screen);
      var friend_width = off_screen_canvas_friend.prop('width');
      var friend_height = off_screen_canvas_friend.prop('height');
      // key-value形式で返却
      return {
        'background_width': background_width,
        'background_height': background_height,
        'friend_width':  friend_width,
        'friend_height': friend_height
      };
    }

    /**
     * フレンズ画像位置調整パラメタUI初期化
     */
    function initializeFriendPositionUI() {
      var config = g.config.friend_position_x;
      initializeRangeConfig(g.id.config.friend_position_x, config.min, config.max, config.step, config.default);
      config = g.config.friend_position_y;
      initializeRangeConfig(g.id.config.friend_position_y, config.min, config.max, config.step, config.default);
    }

    /**
     * 背景画像とフレンズ画像の合成
     * @param {boolean} original_friend true:フィルタ処理前フレンズ表示/false:フィルタ処理後フレンズ表示
     */
    function compositeBackgroundAndFriend(original_friend) {
      // 合成前画像ファイル指定状態取得
      var is_background_specified = isImageSpecified(g.image.type.background);
      var is_friend_specified = isImageSpecified(g.image.type.friend);
      // 合成画像領域canvas情報取得
      var composite_canvas = $(g.id.image.composite_canvas);
      var composite_canvas_context = composite_canvas[0].getContext('2d');
      // 合成前画像ファイル指定状況に対応した処理を実施
      if (is_background_specified || is_friend_specified) {
        // 背景画像ファイルとフレンズ画像ファイルの両方あるいは片方が指定されている
        // 背景画像情報を取得
        var off_screen_canvas_background = $('#' + g.image.type.background + g.id.image.suffix_off_screen);
        // フレンズ画像情報を取得
        var off_screen_canvas_friend = $('#' + g.image.type.friend + g.id.image.suffix_off_screen);
        // 画像合成処理
        var width, height, friend_width, friend_height;
        if (is_friend_specified) {
          // フレンズ画像が指定されている
          // 拡大縮小調整パラメタUIに指定された値に基づいてフレンズ画像をスケーリング計算
          var zoom = $(g.id.config.friend_zoom).get(0).valueAsNumber;
          friend_width = off_screen_canvas_friend.prop('width') * zoom;
          friend_height = off_screen_canvas_friend.prop('height') * zoom;
        }
        if (is_background_specified) {
          // 背景画像が指定されている
          // 合成画像領域描画サーフェイスサイズは背景画像のサイズ
          width = off_screen_canvas_background.prop('width');
          height = off_screen_canvas_background.prop('height');
        } else {
          // 背景画像が指定されていない
          // 合成画像領域描画サーフェイスサイズはフレンズ画像のサイズ
          width = friend_width;
          height = friend_height;
        }
        // 合成画像領域描画サーフェイスサイズを合成前画像ファイル指定状態に応じて設定
        composite_canvas.attr('width', width);
        composite_canvas.attr('height', height);
        // ビューサイズクリア
        composite_canvas.css('width', '');

        var view_height = parseInt(composite_canvas.css('height'));
        var view_width = parseInt(composite_canvas.css('width'));
        if (width < view_width) {
          composite_canvas.css('width', width);
          composite_canvas.data(g.id.data.canvas_zoom, 1);
        } else {
          composite_canvas.css('width', view_width);
          composite_canvas.data(g.id.data.canvas_zoom, view_width / width);
        }

        var composite_view_zoom = $(g.id.image.composite_zoom).get(0).valueAsNumber;
        var before_view_zoom_width = parseInt(composite_canvas.css('width'));
        composite_canvas.css('width', before_view_zoom_width * composite_view_zoom);
        composite_canvas.data(g.id.data.composite_view_zoom, composite_view_zoom);

        composite_canvas.removeClass(g.class.image.off);
        composite_canvas.addClass(g.class.image.on);

        // 背景画像描画→フレンズ画像描画
        if (is_background_specified) {
          composite_canvas_context.drawImage(off_screen_canvas_background.get(0), 0, 0);
        }

        if (is_friend_specified) {
          // 調整パラメタUIの値に基づいて背景画像左上からのフレンズ画像の相対位置を設定
          var position_x = $(g.id.config.friend_position_x).get(0).valueAsNumber;
          var position_y = $(g.id.config.friend_position_y).get(0).valueAsNumber;
          var source_canvas;
          if (original_friend) {
            // オリジナルフレンズ画像
            source_canvas = $('#' + g.image.type.friend + g.id.image.suffix_original_thumbnail);
          } else {
            // フィルタ適用フレンズ画像
            source_canvas = off_screen_canvas_friend;
          }
          composite_canvas_context.drawImage(source_canvas.get(0), position_x, position_y, friend_width, friend_height);
        }
      } else {
        // 背景画像もフレンド画像も指定無し（解除）
        // 合成画像領域全体矩形をクリア
        composite_canvas.removeAttr('width');
        composite_canvas.removeAttr('height');
        composite_canvas.css('width', '');
        composite_canvas.removeClass(g.class.image.on);
        composite_canvas.addClass(g.class.image.off);

        var width = composite_canvas.prop('width');
        var height = composite_canvas.prop('height');
        composite_canvas_context.clearRect(0, 0, width, height);
      }
    }

    /**
     * 画像ファイル読み込み
     * @param {string} image_type 画像種別（フレンズ/背景）
     * @param {Object} view_element 読込先（表示）サムネイル要素jQueryオブジェクト
     * @param {string} image_file_url 画像ファイルURL
     * @return {boolean} true:正常/false:異常
     */
    function loadImage(image_type, view_element, image_file_url) {
      // ファイル読み込みクラス生成
      var file_reader = new FileReader();
      // ファイル読み込み完了ハンドラ
      file_reader.onload = function(evt) {
        // 画像要素(img)生成
        var image = new Image();
        // 画像要素読み込み完了ハンドラ
        image.onload = function() {
          // オリジナル（サムネイル前画像）をサムネイル要素オブジェクトに格納
          view_element.data(g.id.data.original_image, image);
          var view_element_context = view_element.get(0).getContext('2d');
          // ビューサイズ取得
          var view_height = parseInt(view_element.css('height'));
          var view_width = parseInt(view_element.css('width'));
          // サーフェイスサイズを読み込み画像サイズに設定
          view_element.attr('width', image.width);
          view_element.attr('height', image.height);
          if (image.width < view_width) {
            // ビューサイズより画像サイズが小さければ、画像サイズをビューサイズに設定（実寸表示）
            view_element.css('width', image.width);
          } else {
            // ビューサイズより画像サイズが同じか大きければ、ビューサイズを維持（縮小表示）
            view_element.css('width', view_width);
          }
          // 画像描画
          view_element_context.drawImage(image, 0, 0);
          // 画像指定有無に応じたCSSスタイル切換
          view_element.removeClass(g.class.image.off);
          view_element.addClass(g.class.image.on);
          // フィルタ処理
          filteringProcess(image_type);
          // 合成処理
          compositeBackgroundAndFriend(false);
        };
        // 画像要素ソース設定（読み込み実行）
        image.src = evt.target.result;
      };
      // ファイル読み込み実行
      if (image_file_url.type.match('image.*')) {
        file_reader.readAsDataURL(image_file_url);
        // 背景画像読み込みの場合はフレンズ画像位置を初期化
        if (image_type == g.image.type.background) {
          initializeFriendPositionUI();
        }
        return true;
      } else {
        alert(g.message.file_type_is_not_image);
        return false;
      }
    }

    /**
     * ファイル選択input要素再生成
     *     セキュリティ対策上、ファイル指定を外部更新できないため。
     * @param {string} file_id ファイル選択input要素ID
     */
    function regenerateInputFile(file_id) {
      var new_file = $(file_id).clone(true);
      new_file.val('');
      $(file_id).replaceWith(new_file);
    }

    /**
     * 合成前オリジナル画像解除
     * @param {string} image_type 画像種別（フレンズ/背景）
     * @param {string} file_id ファイル選択input要素ID
     */
    function detachImage(image_type, file_id) {
      // 合成前オリジナル画像要素
      var original_thumbnail = $('#' + image_type + g.id.image.suffix_original_thumbnail);

      // ファイル選択input要素再生成
      regenerateInputFile(file_id);
      // ファイル名表示クリア
      $('#' + image_type + g.id.image.suffix_file_view_text).val('');

      // サムネイル画像要素に設定していたオリジナル（サムネイル前）画像情報を未設定状態にする
      original_thumbnail.data(g.id.data.original_image, false);
      original_thumbnail.removeAttr('width');
      original_thumbnail.removeAttr('height');
      original_thumbnail.css('width', '');
      original_thumbnail.removeClass(g.class.image.on);
      original_thumbnail.addClass(g.class.image.off);
      // サムネイル画像描画クリア
      var view_element_context = original_thumbnail.get(0).getContext('2d');
      var width = original_thumbnail.prop('width');
      var height = original_thumbnail.prop('height');
      view_element_context.clearRect(0, 0, width, height);
      drawImageDescription(image_type);

      // フレンズ画像位置調整UI初期化
      initializeFriendPositionUI();
      // 画像再合成（解除画像除去）
      compositeBackgroundAndFriend(false);
      // 画像設定状況に応じて調整UI状態設定
      linkageUI();
    }

    /**
     * 合成画像マウスドラッグ／スワイプ開始共通処理
     * @param {string} target_id 処理対象要素ID
     * @param {number} position_x 開始座標X
     * @param {number} position_y 開始座標Y
     */
    function compositeDragStart(target_id, position_x, position_y) {
      if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
        // 背景画像ファイルとフレンズ画像ファイルの両方が指定されている場合
        // ドラッグアンドドロップによるフレンズ画像位置調整のための情報設定
        // 合成画像領域に付属dataとして設定
        var composite = $(target_id);
        // ドラッグ処理中フラグON
        composite.data(g.id.data.mousedown, true);
        // ドラッグ開始時のフレンズ画像座標（背景画像左上からの相対位置）
        composite.data(g.id.data.mousedown_friend_x, $(g.id.config.friend_position_x).get(0).valueAsNumber);
        composite.data(g.id.data.mousedown_friend_y, $(g.id.config.friend_position_y).get(0).valueAsNumber);
        // ドラッグ開始時のマウスカーソル座標
        composite.data(g.id.data.mousedown_x, position_x);
        composite.data(g.id.data.mousedown_y, position_y);
      }
    }

    /**
     * 合成画像マウスドラッグ／スワイプ開始共通処理
     * @param {string} target_id 処理対象要素ID
     * @param {number} position_x 開始座標X
     * @param {number} position_y 開始座標Y
     */
    function compositeDragMove(target_id, position_x, position_y) {
      if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
        // 背景画像ファイルとフレンズ画像ファイルの両方が指定されている場合
        // ドラッグアンドドロップによるフレンズ画像位置調整のための情報設定
        // 合成画像領域に付属dataとして設定
        var composite = $(target_id);
        if (composite.data(g.id.data.mousedown)) {
          // マウスボタンが押下されている場合のみ
          // フレンズ画像座標をドラッグ移動差分で調整
          // 座標値(x,y) = 現在のフレンズ画像座標 + ((マウスカーソル座標 - ドラッグ開始位置座標) / 表示倍率)
          var position_x = composite.data(g.id.data.mousedown_friend_x) + Math.round((position_x - composite.data(g.id.data.mousedown_x)) / (composite.data(g.id.data.canvas_zoom) * composite.data(g.id.data.composite_view_zoom)));
          var position_y = composite.data(g.id.data.mousedown_friend_y) + Math.round((position_y - composite.data(g.id.data.mousedown_y)) / (composite.data(g.id.data.canvas_zoom) * composite.data(g.id.data.composite_view_zoom)));
          $(g.id.config.friend_position_x).val(position_x);
          $(g.id.config.friend_position_y).val(position_y);
          // x,y個別にchangeイベントトリガを行うと描画が二度走るため調整パラメタ数値表示を直接処理
          $(g.id.config.friend_position_x + g.id.config.suffix_numeric).text(position_x);
          $(g.id.config.friend_position_y + g.id.config.suffix_numeric).text(position_y);
          // 画像合成処理
          compositeBackgroundAndFriend(false);
        }
      }
    }

    /**
     * 合成画像UIの表示レイアウト設定
     * @param {string} layout_type レイアウト種別
     */
    function setLayoutCompositeConfig(layout_type) {
      // レイアウト種別に対応するクラスを取得
      var after_layout_class = g.class.layout.composite_config[layout_type];
      // 要素のレイアウト種別情報を設定
      $(g.id.layout.area_composite_config).data(g.id.data.layout, layout_type);
      // 要素のレイアウトクラス初期化
      $(g.id.layout.area_composite_config).removeClass(g.class.layout.composite_config.type01);
      $(g.id.layout.area_composite_config).removeClass(g.class.layout.composite_config.type02);
      $(g.id.layout.area_composite_config).removeClass(g.class.layout.composite_config.type03);
      $(g.id.layout.area_composite_config).removeClass(g.class.layout.composite_config.type04);
      // 要素のレイアウトクラス設定
      $(g.id.layout.area_composite_config).addClass(after_layout_class);
    }

    /**
     * フレンズ画像調整
     * @param {string} config_id 調整パラメタID
     * @param {number} value パラメタ指定値
     */
    function configFriend(config_id, value) {
      // 対応する数値表示領域に値を設定
      $('#' + config_id + g.id.config.suffix_numeric).text(value);
      // 合成前フレンド画像フィルタ処理
      filteringProcess(g.image.type.friend);
      // 画像合成処理
      compositeBackgroundAndFriend(false);
    }

    /**
     * 背景画像調整
     * @param {string} config_id 調整パラメタID
     * @param {number} value パラメタ指定値
     */
    function configComposite(config_id, value) {
      // 対応する数値表示領域に値を設定
      $('#' + config_id + g.id.config.suffix_numeric).text(value);
      // 画像合成処理
      compositeBackgroundAndFriend(false);
    }

    /**
     * フレンズ画像位置調整処理
     * @param {string} config_id 調整対象位置パラメタID
     * @param {number} value 位置情報
     */
    function configFriendPosition(config_id, value) {
      $(config_id).val(value);
      $(config_id).trigger('change');
    }

    /**
     * UI関連初期化
     */
    function initializeUI() {
      var config;
      // 合成画像拡大縮小調整パラメタUI
      config = g.config.composite_zoom;
      initializeRangeConfig(g.id.image.composite_zoom, config.min, config.max, config.step, config.default);
      // フレンズ画像透明度調整パラメタUI
      config = g.config.friend_transparency;
      initializeRangeConfig(g.id.config.friend_transparency, config.min, config.max, config.step, config.default);
      // フレンズ画像近似色統合調整パラメタUI
      config = g.config.friend_approximate;
      initializeRangeConfig(g.id.config.friend_approximate, config.min, config.max, config.step, config.default);
      // フレンズ画像拡大縮小調整パラメタUI
      config = g.config.friend_zoom;
      initializeRangeConfig(g.id.config.friend_zoom, config.min, config.max, config.step, config.default);
      // フレンズ画像位置調整パラメタUI
      initializeFriendPositionUI();
      // 合成前画像ファイル指定状態に対応したUI調整
      linkageUI();
      // 合成画像／調整UIレイアウト
      var layout_composite_config_type = Cookies.get(g.cookie.name.layout_composite_config);
      setLayoutCompositeConfig(layout_composite_config_type);
    }

    /**
     * SNSシェア関連初期化
     */
    function initializeShare() {
      var text, url, href;
      text = document.title;
      url = document.URL.replace(/\/[^/]*$/, '/');

      // Open Graph Protocol (OGP)
        // Twitter Cardは後からメタ情報をJavascriptで生成してもNG
      
      // Twitter
        // NOP

      // Facebook
        // NOP

      // Google+
        // NOP

      // はてなブックマーク
        // NOP

      // LINE
      $('.' + g.class.share.line).data(g.id.data.url, encodeURI(url));
      if (typeof(LineIt) !== "undefined") {
        // 「LINEで送る」ボタン有効化
        LineIt.loadButton();
      }
    }

    //// イベントハンドラ

    /**
     * ウィンドウリサイズイベントハンドラ
     */
    $(window).on('resize', function() {
      // 画像非表示説明の再描画
      drawImageDescription(g.image.type.friend);
      drawImageDescription(g.image.type.background);
      drawImageDescription(g.image.type.composite);
    });

    /**
     * 合成前オリジナルサムネイル画像表示領域：イベントハンドラ(dragover)
     */
    $('.' + g.class.image.original).on('dragover', function(e) {
      // ブラウザデフォルト挙動抑止
      e.preventDefault();
      // コピータイプに設定
      e.originalEvent.dataTransfer.dropEffect = 'copy';
      // ブラウザデフォルト挙動抑止
      return false;
    });

    /**
     * 合成前オリジナルサムネイル画像表示領域：イベントハンドラ(dragenter)
     */
    $('.' + g.class.image.original).on('dragenter', function(e) {
      // 合成前サムネイル画像要素ID
      var image_id = '#' + this.id;
      // 枠強調
      $(image_id).toggleClass(g.class.image.dragenter, true);
    });

    /**
     * 合成前オリジナルサムネイル画像表示領域：イベントハンドラ(dragleave)
     */
    $('.' + g.class.image.original).on('dragleave', function(e) {
      // 合成前サムネイル画像要素ID
      var image_id = '#' + this.id;
      // 枠強調解除
      $(image_id).toggleClass(g.class.image.dragenter, false);
    });

    /**
     * 合成前オリジナルサムネイル画像表示領域：イベントハンドラ(drop)
     */
    $('.' + g.class.image.original).on('drop', function(e) {
      // ブラウザデフォルト挙動抑止
      e.preventDefault();
      // 合成前サムネイル画像要素ID
      var element_id = '#' + this.id;
      // 画像種別取得（フレンズ/背景）
      var image_type = $(element_id).data(g.id.data.type);
      // 合成前サムネイル画像要素
      var original_thumbnail = $(this);
      // ドロップされた画像ファイルURL(originalEvent:DOMイベントオブジェクト)
      var image_file_url = e.originalEvent.dataTransfer.files[0];
      // input type="file"再生成
      var file_id = '#' + $(element_id).data(g.id.data.file);
      regenerateInputFile(file_id);
      // ファイル選択（表示用ダミー）のファイル名表示
      $('#' + image_type + g.id.image.suffix_file_view_text).val(image_file_url.name);
      // 枠線強調解除
      $(element_id).toggleClass(g.class.image.dragenter, false);
      // 画像ファイル読み込み
      if(!loadImage(image_type, original_thumbnail, image_file_url)) {
        detachImage(image_type, file_id);
      }
      // ブラウザデフォルト挙動抑止
      return false;
    });

    /**
     * 合成前オリジナルサムネイル画像UI：ファイル選択ボタン（表示用ダミー）のクリックイベントハンドラ
     */
    $('.' + g.class.ui.image.file_view).on('click', function() {
      // ファイル選択input要素ID
      var element_id = '#' + this.id;
      // 画像種別取得（フレンズ/背景）
      var image_type = $(element_id).data(g.id.data.type);
      // 非表示のinput要素のクリックハンドラに処理委譲
      $('#' + image_type + g.id.image.suffix_file).click();
    });

    /**
     * 合成前オリジナルサムネイル画像UI：ファイル選択（input要素）の変更イベントハンドラ
     */
    $('.' + g.class.ui.image.file).on('change', function() {
      // ファイル選択input要素ID
      var element_id = '#' + this.id;
      // 画像種別取得（フレンズ/背景）
      var image_type = $(element_id).data(g.id.data.type);
      // 合成前サムネイル画像表示要素
      var original_thumbnail = $('#' + image_type + g.id.image.suffix_original_thumbnail);
      // ファイル選択input要素で指定された画像ファイルURL
      var image_file_url = $(element_id).prop('files')[0];
      // ファイル選択（表示用ダミー）のファイル名表示
      $('#' + image_type + g.id.image.suffix_file_view_text).val(image_file_url.name);
      // 画像ファイル読み込み
      if(!loadImage(image_type, original_thumbnail, image_file_url)) {
        detachImage(image_type, element_id);
      }
    });

    /**
     * 合成前オリジナルサムネイル画像UI：解除ボタンクリックイベントハンドラ
     */
    $('.' + g.class.ui.image.off).on('click', function() {
      // 解除UI要素ID
      var click_id = '#' + this.id;
      // 画像種別取得（フレンズ/背景）
      var image_type = $(click_id).data(g.id.data.type);
      // ファイル選択input要素ID取得
      var file_id = '#' + $(click_id).data(g.id.data.file);
      // 画像解除
      detachImage(image_type, file_id);
    });

    /**
     * 合成後画像表示領域：イベントハンドラ(mousedown)
     */
    $(g.id.image.composite_canvas).on('mousedown', function(e) {
      compositeDragStart('#' + this.id, e.clientX, e.clientY);
    });

    /**
     * 合成後画像表示領域：イベントハンドラ(touchstart)
     */
    $(g.id.image.composite_canvas).on('touchstart', function(e) {
      e.preventDefault();
      compositeDragStart('#' + this.id, e.changedTouches[0].pageX, e.changedTouches[0].pageY);
    });

    /**
     * 合成後画像表示領域：イベントハンドラ(mouseup touchend)
     */
    $(g.id.image.composite_canvas).on('mouseup touchend', function(e) {
      if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
        // 背景画像ファイルとフレンズ画像ファイルの両方が指定されている場合
        // ドラッグアンドドロップによるフレンズ画像位置調整のための情報設定
        // 合成画像領域に付属dataとして設定
        var composite = $('#' + this.id);
        // ドラッグ処理中フラグOFF
        composite.data(g.id.data.mousedown, false);
        // フレンズ画像位置はマウスカーソル移動イベントの最終位置のまま（ドラッグしていた場合）
      }
    });

    /**
     * 合成後画像表示領域：イベントハンドラ(mousemove)
     */
    $(g.id.image.composite_canvas).on('mousemove', function(e) {
      compositeDragMove('#' + this.id, e.clientX, e.clientY);
    });


    /**
     * 合成後画像表示領域：イベントハンドラ(touchmove)
     */
    $(g.id.image.composite_canvas).on('touchmove', function(e) {
      e.preventDefault();
      compositeDragMove('#' + this.id, e.changedTouches[0].pageX, e.changedTouches[0].pageY);
    });

    /**
     * 合成後画像表示領域：イベントハンドラ(mouseout touchcancel)
     */
    $(g.id.image.composite_canvas).on('mouseout touchcancel', function(e) {
      if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
        // 背景画像ファイルとフレンズ画像ファイルの両方が指定されている場合
        // ドラッグアンドドロップによるフレンズ画像位置調整のための情報設定
        // 合成画像領域に付属dataとして設定
        var composite = $('#' + this.id);
        if (composite.data(g.id.data.mousedown)) {
          // マウスボタンが押下されている場合のみ
          // ドラッグしたまま領域外にマウスカーソルが出た場合はドラッグアンドドロップキャンセル
          // ドラッグ処理中フラグOFF
          composite.data(g.id.data.mousedown, false);
          // フレンズ画像座標をドラッグ開始
          var position_x = composite.data(g.id.data.mousedown_friend_x);
          var position_y = composite.data(g.id.data.mousedown_friend_y);
          $(g.id.config.friend_position_x).val(position_x);
          $(g.id.config.friend_position_y).val(position_y);
          // x,y個別にchangeイベントトリガを行うと描画が二度走るため直接処理
          $(g.id.config.friend_position_x + g.id.config.suffix_numeric).text(position_x);
          $(g.id.config.friend_position_y + g.id.config.suffix_numeric).text(position_y);
          compositeBackgroundAndFriend(false);
        }
      }
    });

    /**
     * 合成画像表示領域：イベントハンドラ(mouseenter)
     */
    $(g.id.image.composite_canvas).on('mouseenter', function(e) {
      if (isImageSpecified(g.image.type.background) && isImageSpecified(g.image.type.friend)) {
        // 背景画像ファイルとフレンズ画像ファイルの両方が指定されている場合
        // マウスカーソルを移動可能風に
        $('#' + this.id).css('cursor', 'move');
      } else {
        $('#' + this.id).css('cursor', '');
      }
    });

    /**
     * 合成画像表示領域：イベントハンドラ(dragover)
     */
    $(g.id.image.composite_canvas).on('dragover', function(e) {
      // ブラウザデフォルト挙動抑止
      e.preventDefault();
      // ドロップ禁止に設定
      e.originalEvent.dataTransfer.dropEffect = 'none';
      // ブラウザデフォルト挙動抑止
      return false;
    });

    /**
     * 合成画像UI：ダウンロードイベントハンドラ
     */
    $(g.id.image.composite_saveas).on('click', function() {
      var composite_canvas = $(g.id.image.composite_canvas);
      composite_canvas.get(0).toBlob(function(blob) {
        saveAs(blob, g.file.saveas);
      });
    });

    /**
     * 合成画像UI：別画面表示ボタンクリックイベントハンドラ
     */
    $(g.id.image.composite_popup).on('click', function() {
      // 合成画像canvasのイメージデータをURLとして別ウィンドウオープン
      var composite_canvas = $(g.id.image.composite_canvas);
      // window.open(data_url)や、
      // window.location.href = data_urlはIEで不可
      var data_url = composite_canvas.get(0).toDataURL();
      var popup = window.open('about:blank');
      popup.document.write('<img src="' + data_url + '"/>');
      popup = null;
    });

    /**
     * 合成画像UI：オリジナルフレンズ一時表示ボタンイベントハンドラ(mousedown touchstart)
     */
    $(g.id.image.composite_original_friend).on('mousedown touchstart', function() {
      // フィルタ処理前のフレンズ画像で合成
      compositeBackgroundAndFriend(true);
    });

    /**
     * 合成画像UI：オリジナルフレンズ一時表示ボタンイベントハンドラ(mouseup mouseleave touchend touchcancel)
     */
    $(g.id.image.composite_original_friend).on('mouseup mouseleave touchend touchcancel', function() {
      // フィルタ処理後のフレンズ画像で合成
      compositeBackgroundAndFriend(false);
    });

    /**
     * 合成画像UI：調整表示場所切換ボタンクリックイベントハンドラ
     */
    $(g.id.layout.switch_composite_config).on('click', function() {
      // 現在のレイアウト種別を取得
      var before_layout = $(g.id.layout.area_composite_config).data(g.id.data.layout);
      var after_layout;
      // レイアウト種別トグル（種別数字の剰余計算でも可能だが汎用化のため単純switch）
      switch(before_layout) {
      case "type01":
        after_layout = "type02";
        break;

      case "type02":
        after_layout = "type03";
        break;

      case "type03":
        after_layout = "type04";
        break;

      case "type04":
      default:
        after_layout = "type01";
        break;
      }
      // レイアウト種別に応じたスタイルクラス設定
      setLayoutCompositeConfig(after_layout);
      // ウィンドウサイズ変更直後の場合にスケールがずれる場合があるため再描画
      drawImageDescription(g.image.type.composite);
      // ブラウザ終了後も設定を維持
      Cookies.set(g.cookie.name.layout_composite_config, after_layout,
        {
          expires: g.cookie.expires,
        }
      );
    });

    /**
     * 調整UI：フレンズ画像関連調整パラメタイベントハンドラ
     */
    $('.' + g.class.ui.config.friend).on('input change', function() {
      // フレンズ画像調整
      configFriend(this.id, this.value);
    });

    /**
     * 調整UI：合成画像関連調整パラメタイベントハンドラ
     */
    $('.' + g.class.ui.config.composite).on('input change', function() {
      // 合成画像調整
      configComposite(this.id, this.value);
    });

    /**
     * 調整UI：フレンズ画像左寄せボタンクリックイベントハンドラ
     */
    $(g.id.config.friend_position_left).on('click', function() {
      // X座標:0
      configFriendPosition(g.id.config.friend_position_x, 0);
    });

    /**
     * 調整UI：フレンズ画像右寄せボタンクリックイベントハンドラ
     */
    $(g.id.config.friend_position_right).on('click', function() {
      // X座標:背景画像幅 - フレンズ画像幅
      var size = getCompositeSize();
      configFriendPosition(g.id.config.friend_position_x, size.background_width - size.friend_width);
    });

    /**
     * 調整UI：フレンズ画像上寄せボタンクリックイベントハンドラ
     */
    $(g.id.config.friend_position_top).on('click', function() {
      // Y座標:0
      configFriendPosition(g.id.config.friend_position_y, 0);
    });

    /**
     * 調整UI：フレンズ画像下寄せボタンクリックイベントハンドラ
     */
    $(g.id.config.friend_position_bottom).on('click', function() {
      // Y座標:背景画像高さ - フレンズ画像高さ
      var size = getCompositeSize();
      configFriendPosition(g.id.config.friend_position_y, size.background_height - size.friend_height);
    });

    //// 初期実行処理

    // UI関連初期化
    initializeUI();
    // SNSシェア関連初期化
    initializeShare();
  },
  /**
   * 定義ファイル(JSON形式)読込異常時
   */
  function() {
    alert('JSONファイル（定義ファイル）読み込みに失敗しました');
  });
});
