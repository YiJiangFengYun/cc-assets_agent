const gulp = require("gulp");
const uglify = require('gulp-uglify');

gulp.task("dist", gulp.series(
    doUglify,
    copyDTS,
));

function doUglify() {
    return gulp.src("build/*.js")
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
}

function copyDTS() {
    return gulp.src("build/*.d.ts")
    .pipe(gulp.dest('dist'));
}


